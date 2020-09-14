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

  let method = null;
  let params = null;

  if (message) {
      method = message.method;
      params = message.params;

      if (!params) {
          params = {};
      }
  }

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
      if (name && webViewRef && webViewRef.current) {
        dispatchEventToWebView(webViewRef.current, name, event);
      }
    },
    [name, webViewRef],
  );

  const handleWebViewCall = React.useCallback(
    (event, sessionName, sessionWebViewRef) => {
      let eventType = null;

      switch (event ? event.type : null) {
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
      valid: name && webViewRef && webViewRef.current,
      dispatchEvent,
      handler: handleWebViewCall,
    };
  }, [name, webViewRef, handleWebViewCall, dispatchEvent]);

  return session;
}

export function useWebViewBridge(bridgeName, eventCallback) {
  const sessionName = React.useMemo(
    () =>
      `@react-native-webview-bridge/session/${bridgeName}`,
    [bridgeName],
  );

  React.useEffect(() => {
    function onNativeProviderEvent(e) {
      const eventData = JSON.parse(e.data);
      eventCallback(eventData);
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

function dispatchEventToWebView(webView, sessionName, data) {
  const dispatchData = JSON.stringify(data);

  webView.injectJavaScript(`
  (function() {
    var event = new MessageEvent(
      '${sessionName}',
      {data: String.raw\`${dispatchData}\`}
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
