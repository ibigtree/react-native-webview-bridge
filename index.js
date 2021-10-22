import {useState, useMemo, useEffect, useCallback, useRef} from "react";

export function useWebViewBridgeConnector(webViewRef, sessions) {
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const sessionCallback = useCallback(
    ({ handlerName, sessionName, event }) => {
      const session = sessionsRef.current[handlerName];

      if (session) {
        session.callback(event, sessionName, webViewRef);
      } else {
        console.error(`Handler missing: ${handlerName}`);
      }
    },
    [webViewRef]
  );

  const handleMessage = useCallback((e) => {
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

    if (method === "@react-native-webview-bridge/call") {
      sessionCallback({
        handlerName: params.handlerName,
        sessionName: params.sessionName,
        event: params.data,
      });

      return true;
    }

    return false;
  }, [sessionCallback]);

  return handleMessage;
}

export function handleWebViewOnMessage(e, connector) {

}

export function useWebViewBridgeSession(callback) {
  const [webViewRefMap, setWebViewRefMap] = useState({});
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const dispatchEvent = useCallback(
    (event) => {
      for (const sessionName of Object.keys(webViewRefMap)) {
        const webViewRef = webViewRefMap[sessionName];

        if (webViewRef && webViewRef.current) {
          dispatchEventToWebView(webViewRef.current, sessionName, event);
        }
      }
    },
    [webViewRefMap]
  );

  const handleWebViewCall = useCallback(
    (event, sessionName, sessionWebViewRef) => {
      let eventType = null;

      switch (event ? event.type : null) {
        case "@react-native-webview-bridge/startSession": {
          setWebViewRefMap((prevRefMap) => {
            return {
              ...prevRefMap,
              [sessionName]: sessionWebViewRef,
            }
          });
          break;
        }

        case "@react-native-webview-bridge/endSession": {
          setWebViewRefMap((prevRefMap) => {
            const newRefMap = {...prevRefMap};
            delete newRefMap[sessionName];
            return newRefMap;
          });
          break;
        }

        default: {
          callbackRef.current(event, dispatchEvent);
          break;
        }
      }
    },
    [dispatchEvent]
  );

  const session = useMemo(() => {
    return {
      valid: Object.keys(webViewRefMap).length > 0,
      dispatchEvent,
      callback: handleWebViewCall,
    };
  }, [webViewRefMap, handleWebViewCall, dispatchEvent]);

  return session;
}

export function useWebViewBridge(bridgeName, eventCallback) {
  const eventCallbackRef = useRef(eventCallback);

  useEffect(() => {
    eventCallbackRef.current = eventCallback;
  }, [eventCallback]);

  const sessionName = useMemo(
    () =>
      `@react-native-webview-bridge/session/${bridgeName}-${new Date().getTime()}`,
    [bridgeName]
  );

  useEffect(() => {
    function onWebViewBridgeSessionEvent(e) {
      const eventData = JSON.parse(e.data);
      eventCallbackRef.current(eventData);
    }

    window.addEventListener(sessionName, onWebViewBridgeSessionEvent);

    callNative(bridgeName, sessionName, {
      type: "@react-native-webview-bridge/startSession",
    });

    return () => {
      callNative(bridgeName, sessionName, {
        type: "@react-native-webview-bridge/endSession",
      });

      window.removeEventListener(sessionName, onWebViewBridgeSessionEvent);
    };
  }, [bridgeName, sessionName]);

  const call = useCallback(
    (data) => {
      callNative(bridgeName, sessionName, data);
    },
    [bridgeName, sessionName]
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
        data ? JSON.stringify(data) : ""
      })) but Native App is missing.`
    );
    return;
  }

  window.ReactNativeWebView.postMessage(
    JSON.stringify({
      method: "@react-native-webview-bridge/call",
      params: {
        handlerName,
        sessionName,
        data,
      },
    })
  );
}
