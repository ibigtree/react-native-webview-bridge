import {useState} from 'react';
import {useWebViewBridge, WebViewBridgeEvent} from '@ibigtree/react-native-webview-bridge';


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

type TestBridgeEvent = TestBridgeRequestEvent | TestBridgeResponseEvent | TestBridgeTickEvent;


function App() {
  const [nativeTick, setNativeTick] = useState(0);

  const testBridge = useWebViewBridge<TestBridgeEvent>('TestBridge', (event) => {
    switch (event.type) {
      case 'response':
        alert(event.data);
        break;

      case 'tick':
        setNativeTick(event.data);
        break;
    }
  })

  return (
    <div className="App">
      <p>Native App Tick: {nativeTick}</p>
      <button onClick={() => {
        testBridge({
          type: 'request',
          data: '(Web) Hello',
        })
      }}>
        Send Message to Native Bridge
      </button>
    </div>
  );
}

export default App;
