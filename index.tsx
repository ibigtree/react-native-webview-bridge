import React, { useState, useMemo, useEffect, useCallback, useRef, Ref, useContext, createContext } from 'react';
import WebView from 'react-native-webview';
import { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

declare global {
  interface Window {
    ReactNativeWebView: WebView;
  }
}

export interface WebViewBridgeEvent {
  type: string;
}

export interface WebViewBridgeSession<T extends WebViewBridgeEvent> {
  valid: boolean;
  dispatchEvent(event: T): void;
  handler(event: T, sessionName: string, sessionWebViewRef: Ref<WebView>): void;
}

export interface WebViewBridgeCallback<T extends WebViewBridgeEvent> {
  (event: T, dispatchEvent: (event: T) => void): void;
}

export interface WebViewBridgeConnector {
  (e: WebViewMessageEvent): boolean;
}

export interface WebViewBridgeSessionMap<T extends WebViewBridgeEvent> {
  [sessionName: string]: WebViewBridgeSession<T>;
}

export interface WebViewBridgeSessionInitEvent extends WebViewBridgeEvent {
  type: '@react-native-webview-bridge/initializedSession';
}

export interface WebViewBridgeSessionStartEvent extends WebViewBridgeEvent {
  type: '@react-native-webview-bridge/startSession';
}

export interface WebViewBridgeSessionEndEvent extends WebViewBridgeEvent {
  type: '@react-native-webview-bridge/endSession';
}

export type WebViewBridgeInternalEvent =
  | WebViewBridgeSessionStartEvent
  | WebViewBridgeSessionEndEvent
  | WebViewBridgeSessionInitEvent;

export function useWebViewBridgeConnector<T extends WebViewBridgeEvent = WebViewBridgeEvent>(
  webViewRef: Ref<WebView>,
  sessions: WebViewBridgeSessionMap<T>,
): WebViewBridgeConnector {
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const sessionCallback = useCallback(
    ({ handlerName, sessionName, event }) => {
      const session = sessionsRef.current[handlerName];

      if (session) {
        session.handler(event, sessionName, webViewRef);
      } else {
        console.error(`Handler missing: ${handlerName}`);
      }
    },
    [webViewRef],
  );

  const handleMessage = useCallback(
    e => {
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
        sessionCallback({
          handlerName: params.handlerName,
          sessionName: params.sessionName,
          event: params.data,
        });

        return true;
      }

      return false;
    },
    [sessionCallback],
  );

  return handleMessage;
}

export function useWebViewBridgeSession<T extends WebViewBridgeEvent>(
  callback: WebViewBridgeCallback<T>,
): WebViewBridgeSession<T> {
  const [webViewRefMap, setWebViewRefMap] = useState<
    Record<string, Ref<WebView>>
  >({});
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const dispatchEvent = useCallback(
    (event: T | WebViewBridgeInternalEvent) => {
      for (const sessionName of Object.keys(webViewRefMap)) {
        const webViewRef = webViewRefMap[sessionName];

        if (
          !webViewRef ||
          typeof webViewRef !== 'object' ||
          webViewRef?.current === null
        ) {
          return;
        }

        dispatchEventToWebView(webViewRef.current, sessionName, event);
      }
    },
    [webViewRefMap],
  );

  const handleWebViewCall = useCallback(
    (event: T, sessionName: string, sessionWebViewRef: Ref<WebView>) => {
      switch (event.type) {
        case '@react-native-webview-bridge/startSession': {
          setWebViewRefMap(prevRefMap => {
            return {
              ...prevRefMap,
              [sessionName]: sessionWebViewRef,
            };
          });

          if (
            sessionWebViewRef &&
            typeof sessionWebViewRef === 'object' &&
            sessionWebViewRef.current
          ) {
            dispatchEventToWebView(sessionWebViewRef.current, sessionName, {
              type: '@react-native-webview-bridge/initializedSession',
            });
          }
          break;
        }

        case '@react-native-webview-bridge/endSession': {
          setWebViewRefMap(prevRefMap => {
            const newRefMap = { ...prevRefMap };
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
    [dispatchEvent],
  );

  const session = useMemo(() => {
    return {
      valid: Object.keys(webViewRefMap).length > 0,
      dispatchEvent,
      handler: handleWebViewCall,
    };
  }, [webViewRefMap, handleWebViewCall, dispatchEvent]);

  return session;
}

export function useWebViewBridge<T extends WebViewBridgeEvent>(
  bridgeName: string,
  eventCallback?: WebViewBridgeCallback<T>,
): (event: T) => void {
  const eventCallbackRef = useRef(eventCallback);
  const state = useRef({
    initialized: false,
    queue: [] as T[],
  });

  useEffect(() => {
    eventCallbackRef.current = eventCallback;
  }, [eventCallback]);

  const sessionName = useMemo(
    () =>
      `@react-native-webview-bridge/session/${bridgeName}-${new Date().getTime()}`,
    [bridgeName],
  );

  const dispatchEventToNative = useCallback(
    data => {
      if (state.current.initialized) {
        callNative(bridgeName, sessionName, data);
      } else {
        // Queue event if not initialized yet
        state.current.queue.push(data);
      }
    },
    [bridgeName, sessionName],
  );

  useEffect(() => {
    function onWebViewBridgeSessionEvent(e: MessageEvent) {
      const eventData = JSON.parse(e.data) as T;

      if (
        eventData.type === '@react-native-webview-bridge/initializedSession'
      ) {
        // Fire all queued events
        state.current.initialized = true;
        state.current.queue.forEach(queuedEvent => {
          dispatchEventToNative(queuedEvent);
        });
        state.current.queue = [];
      }

      eventCallbackRef.current?.(eventData, dispatchEventToNative);
    }

    window.addEventListener(
      sessionName as 'message',
      onWebViewBridgeSessionEvent,
    );

    callNative(bridgeName, sessionName, {
      type: '@react-native-webview-bridge/startSession',
    });

    return () => {
      callNative(bridgeName, sessionName, {
        type: '@react-native-webview-bridge/endSession',
      });

      window.removeEventListener(
        sessionName as 'message',
        onWebViewBridgeSessionEvent,
      );
    };
  }, [sessionName, dispatchEventToNative]);

  return dispatchEventToNative;
}

function dispatchEventToWebView(
  webView: WebView,
  sessionName: string,
  data: WebViewBridgeEvent,
) {
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

function callNative(handlerName: string, sessionName: string, data = {}) {
  if (!window.ReactNativeWebView) {
    console.warn(
      `Called WebViewBridge ${handlerName}(${data ? JSON.stringify(data) : ''
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

interface WebViewBridgeSessionContext<T extends WebViewBridgeEvent> {
  webViewBridgeSession: WebViewBridgeSession<T>;
}


export function createWebViewBridgeSessionContext<T extends WebViewBridgeEvent>(
  useSessionContextState: () => WebViewBridgeSessionContext<T>,
) {
  const SessionContext = createContext<WebViewBridgeSessionContext<T> | undefined>(
    undefined,
  );

  const useSessionContext = () => {
    const context = useContext(SessionContext);

    if (context === undefined) {
      throw new Error(`Context ${SessionContext} Not Found`);
    }

    return context;
  };

  const SessionProvider = ({ children }: { children: React.ReactNode }) => {
    const state = useSessionContextState();

    return (
      <SessionContext.Provider value={state}>
        {children}
      </SessionContext.Provider>
    );
  };

  return {
    useSessionContext,
    SessionProvider,
    SessionContext,
  };
}
