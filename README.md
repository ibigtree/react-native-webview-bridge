# @ibigtree/react-native-webview-bridge

WebView - Web 사이 통신을 위한 Bridge

## 설치

```
npm install --save @ibigtree/react-native-webview-bridge
```

## 사용법

Native 에서 브릿지 정의


```javascript
import React from 'react';
import WebView from 'react-native-webview';

import {
  useWebViewBridgeSession,
  useWebViewBridgeConnector,
  handleWebViewOnMessage,
} from '~/common/webViewBridge';

export default function WebViewScreen(someMessage = '') {
  const webViewRef = React.useRef();

  const testFunctionSession = useWebViewBridgeSession(
    React.useCallback((event, dispatchEvent) => {
      if (event.type === 'request') {
        // 콜백에 바로 결과 전달하는 경우
        dispatchEvent({type: 'response', data: 'Hello!'});
      }
    }, []),
  );

  // 나중에 결과 전달하는 경우
  React.useEffect(() => {
    testFunctionSession.dispatchEvent({
      type: 'lazyResponse',
      data: someMessage,
    });
  }, [testFunctionSession, someMessage]);

  // 'TestBridge'로 브릿지 생성
  const webViewBridgeConnector = useWebViewBridgeConnector(
    webViewRef,
    React.useMemo(
      () => ({
        TestBridge: testFunctionSession.handler,
      }),
      [testFunctionSession.handler],
    ),
  );

  return (
    <WebView
      ref={webViewRef}
      onMessage={(e) => {
        if (handleWebViewOnMessage(e, webViewBridgeConnector)) {
          return;
        }
        // 다른 onMessage 처리
      }}
    />
  );
}
```

웹 페이지에서 브릿지 호출

```javascript
import React from 'react';

import {useWebViewBridge} from '~/common/webViewBridge';

export default function BridgeTestPage() {
  const callTestBridge = useWebViewBridge(
    'TestBridge',
    React.useCallback((event) => {
      switch (event.type) {
        case 'response':
          console.log('response: ' + event.data);
          break;
        case 'lazyResponse':
          console.log('lazy response: ' + event.data);
          break;
      }
    }, []),
  );

  return (
    <div>
      <button
        onClick={() => {
          callTestBridge({type: 'request'});
        }}
      />
    </div>
  );
}
```