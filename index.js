import React from 'react';

export function useWebViewBridgeConnector(webViewRef, handlers) {
  const connector = React.useCallback(
    ({handlerName, sessionName, event}) => {
      const handler = handlers[handlerName];

      if (handler) {
        handler(event, sessionName, webViewRef);
      } else {
        console.error(`Handler missing: ${handlerName}`);
      }
    },
    [handlers, webViewRef],
  );

  return connector;
}

export function handleWebViewOnMessage(e, connector) {
  let message = null;

  try {
    message = JSON.parse(e.nativeEvent.data);
  } catch (error) {
    return false;
  }

  let method = message?.method;
  let params = message?.params ?? {};

  if (method === '@react-native-webview-bridge/call') {
    connector({
      handlerName: params.handlerName,
      sessionName: params.sessionName,
      event: params.data,
    });

    return true;
  }

  return false;
}

export function useWebViewBridgeSession(handler) {
  const [name, setName] = React.useState(null);
  const [webViewRef, setWebViewRef] = React.useState(null);

  const dispatchEvent = React.useCallback(
    (event) => {
      if (name && webViewRef?.current) {
        dispatchEventToWebView(webViewRef.current, name, event);
      }
    },
    [name, webViewRef],
  );

  const handleWebViewCall = React.useCallback(
    (event, sessionName, sessionWebViewRef) => {
      switch (event?.type) {
        case '@react-native-webview-bridge/startSession': {
          setName(sessionName);
          setWebViewRef(sessionWebViewRef);
          break;
        }

        case '@react-native-webview-bridge/endSession': {
          setName(null);
          setWebViewRef(null);
          break;
        }

        default: {
          handler(event, dispatchEvent);
          break;
        }
      }
    },
    [handler, dispatchEvent],
  );

  const session = React.useMemo(() => {
    return {
      valid: name && webViewRef?.current,
      dispatchEvent,
      handler: handleWebViewCall,
    };
  }, [name, webViewRef, handleWebViewCall, dispatchEvent]);

  return session;
}

export function useWebViewBridge(bridgeName, eventCallback) {
  const sessionName = React.useMemo(
    () =>
      `@react-native-webview-bridge/session/${bridgeName}-${new Date().getTime()}`,
    [bridgeName],
  );

  React.useEffect(() => {
    function onNativeProviderEvent(e) {
      const eventData = JSON.parse(e.data);
      eventCallback(eventData.type, eventData.data);
    }

    window.addEventListener(sessionName, onNativeProviderEvent);
    callNative(bridgeName, sessionName, {
      type: '@react-native-webview-bridge/startSession',
    });

    return () => {
      callNative(bridgeName, sessionName, {
        type: '@react-native-webview-bridge/endSession',
      });
      window.removeEventListener(sessionName, onNativeProviderEvent);
    };
  }, [bridgeName, eventCallback, sessionName]);

  const call = React.useCallback(
    (data) => {
      callNative(bridgeName, sessionName, data);
    },
    [bridgeName, sessionName],
  );

  return call;
}

function dispatchEventToWebView(webView, sessionName, type, event) {
  const dispatchData = JSON.stringify({type, event});

  webView.injectJavaScript(`
  (function() {
    var event = new MessageEvent(
      '${sessionName}',
      {data: '${dispatchData}'}
    );

    window.dispatchEvent(event);
  })();
`);
}

function callNative(handlerName, sessionName, data = {}) {
  if (!window.ReactNativeWebView) {
    console.warn(
      `Called WebViewBridge ${handlerName}(${
        data ? JSON.stringify(data) : ''
      })) but Native App is missing.`,
    );
    return;
  }

  window.ReactNativeWebView.postMessage(
    JSON.stringify({
      method: '@react-native-webview-bridge/call',
      params: {
        handlerName,
        sessionName,
        data,
      },
    }),
  );
}
