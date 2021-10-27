import React from "react";
import WebView from "react-native-webview";
import { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

export interface WebViewBridgeConnectorParams {
    handlerName: string;
    sessionName: string;
}

export interface WebViewBridgeEvent {
    type: string;
}

export interface WebViewBridgeSession<T = unknown> {
    valid: boolean;
    dispatchEvent(event: T): void;
    handler: WebViewBridgeSessionCallback<T>;
}

export interface WebViewBridgeSessionCallback<T = unknown> {
    (event: T, dispatchEvent: (event: T) => void): void;
}

export interface WebViewBridgeConnector {
    (e: WebViewMessageEvent): boolean;
}

export function useWebViewBridgeConnector<T = unknown>(webViewRef: React.Ref<WebView>, sessions: T): WebViewBridgeConnector;
export function useWebViewBridgeSession<T = unknown>(callback: WebViewBridgeSessionCallback<T>): WebViewBridgeSession<T>;
export function useWebViewBridge<T = unknown>(bridgeName: string, eventCallback: WebViewBridgeSessionCallback<T>): (event: T) => void;
