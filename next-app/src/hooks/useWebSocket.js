'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

const WS_RECONNECT_DELAY = 3000;
const WS_PING_INTERVAL = 25000;

/**
 * useWebSocket — manages a persistent WebSocket connection for real-time chat.
 *
 * @param {string} token - JWT auth token
 * @param {function} onMessage - callback invoked with parsed message data
 * @returns {{ isConnected: boolean }}
 */
export const useWebSocket = (token, onMessage) => {
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const pingTimerRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const onMessageRef = useRef(onMessage);

    // Keep callback ref fresh without triggering reconnect
    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        if (!token) return;

        // Determine WS URL from current window location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
        const wsUrl = `${protocol}//${host}/ws/chat?token=${encodeURIComponent(token)}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                // Start keep-alive pings
                pingTimerRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send('ping');
                    }
                }, WS_PING_INTERVAL);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    onMessageRef.current?.(data);
                } catch (e) {
                    // Ignore non-JSON frames (pong etc.)
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                cleanup();
                // Auto-reconnect
                reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_DELAY);
            };

            ws.onerror = () => {
                // onclose will fire after onerror, so reconnect is handled there
                ws.close();
            };
        } catch (e) {
            console.error('WebSocket connection error:', e);
            reconnectTimerRef.current = setTimeout(connect, WS_RECONNECT_DELAY);
        }
    }, [token]);

    const cleanup = useCallback(() => {
        if (pingTimerRef.current) {
            clearInterval(pingTimerRef.current);
            pingTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        connect();

        return () => {
            cleanup();
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect on unmount
                wsRef.current.close();
            }
        };
    }, [connect, cleanup]);

    return { isConnected };
};
