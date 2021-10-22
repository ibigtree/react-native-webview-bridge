/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, {useEffect, useRef} from 'react';
import {SafeAreaView, StyleSheet} from 'react-native';
import WebView from 'react-native-webview';
import {
  useWebViewBridgeSession,
  WebViewBridgeEvent,
  useWebViewBridgeConnector,
} from '@ibigtree/react-native-webview-bridge';

interface TestBridgeRequestEvent extends WebViewBridgeEvent {
  type: 'request';
  data: string;
}

interface TestBridgeResponseEvent extends WebViewBridgeEvent {
  type: 'response';
  data: string;
}

interface TestBridgeTickEvent extends WebViewBridgeEvent {
  type: 'tick';
  data: number;
}

type TestBridgeEvent =
  | TestBridgeRequestEvent
  | TestBridgeResponseEvent
  | TestBridgeTickEvent;

function App() {
  const webViewRef = useRef<WebView>(null);

  // Create native session
  const testBridgeSession = useWebViewBridgeSession<TestBridgeEvent>(
    (event, dispatchEvent) => {
      switch (event.type) {
        case 'request':
          dispatchEvent({
            type: 'response',
            data: event.data + ' (Native) World!',
          });
          break;
      }
    },
  );

  // Send Message lazily/without request
  useEffect(() => {
    let i = 0;

    const interval = setInterval(() => {
      testBridgeSession.dispatchEvent({
        type: 'tick',
        data: i,
      });

      i++;
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [testBridgeSession]);

  const handleMessage = useWebViewBridgeConnector(webViewRef, {
    TestBridge: testBridgeSession,
  });

  return (
    <SafeAreaView style={StyleSheet.absoluteFill}>
      <WebView
        ref={webViewRef}
        source={{uri: 'http://127.0.0.1:3000'}}
        onMessage={e => {
          if (handleMessage(e)) {
            // Already handled WebViewBridge messages
            return;
          }
        }}
      />
    </SafeAreaView>
  );
}

export default App;
