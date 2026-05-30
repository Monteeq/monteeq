import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCrypto } from '../hooks/useCrypto';
import { useGoogleDrive } from '../hooks/useGoogleDrive';
import { useChatDB } from '../hooks/useChatDB';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNotification } from '../context/NotificationContext';
import { 
    getConversations, 
    getChatMessages, 
    sendChatMessage, 
    getUserPublicKey, 
    uploadPublicKey,
    uploadChatAttachment,
    searchUnified,
    getFollowing,
    linkGoogleAccount,
    uploadPrekeyBundle,
    getRecipientPrekeyBundles,
    acknowledgeMessages
} from '../api';
import { Key, Cloud, Home, MessageSquare, UserPlus, Zap, ShieldCheck, ShieldAlert } from 'lucide-react';
import ChatList from '../components/chat/ChatList';
import ChatWindow from '../components/chat/ChatWindow';
import { useGoogleLogin } from '@react-oauth/google';
import './Chat.css';
import logo from '../assets/images/logo.png';

const Chat = () => {
    const { user, token, setUser } = useAuth();
    const { showNotification } = useNotification();
    const { saveMessage, getMessagesForConversation, saveConversation, getLocalConversations } = useChatDB();
    const location = useLocation();
    const deviceId = useMemo(() => {
        let devId = localStorage.getItem('monteeq_device_id');
        if (!devId) {
            devId = 'device_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
            localStorage.setItem('monteeq_device_id', devId);
        }
        return devId;
    }, []);
    const { 
        generateKeyPair, 
        encryptMessage, 
        decryptMessage, 
        encryptBinary, 
        decryptBinary,
        encryptMessageMultiDevice,
        encryptMultiDevice,
        exportPrivateKey,
        importPrivateKey,
        nukeKeys,
        getLocalPublicKey,
        hasLocalKey 
    } = useCrypto();

    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [decryptedMessages, setDecryptedMessages] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [isSetup, setIsSetup] = useState(false);
    const [isDiscoveryMode, setIsDiscoveryMode] = useState(false);
    const [discoveryUsers, setDiscoveryUsers] = useState([]);
    const [isInitialSync, setIsInitialSync] = useState(true);
    const [hasKeyMismatch, setHasKeyMismatch] = useState(false);
    const [showSecurityPortal, setShowSecurityPortal] = useState(false);
    const decryptionQueueRef = useRef(new Set());
    const lastHealAttemptRef = useRef(0);
    const activeConvIdRef = useRef(null);
    const [lastBackupTime, setLastBackupTime] = useState(localStorage.getItem('monteeq_last_backup_time'));
    const [isConvsLoaded, setIsConvsLoaded] = useState(false);

    const drive = useGoogleDrive(async (driveToken) => {
        // Callback when drive authenticates
        await performDriveSync(driveToken);
    });

    const handleGoogleLink = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const linkRes = await linkGoogleAccount(tokenResponse.access_token, token);
                if (linkRes.google_id) {
                    setUser(linkRes);
                    // drive hook will automatically have access to updated user
                    // We might need to manually trigger sync if it doesn't happen
                }
            } catch (err) {
                console.error("Link failed", err);
            }
        },
        scope: 'https://www.googleapis.com/auth/drive.file email profile'
    });

    const performDriveSync = useCallback(async (driveToken) => {
        if (!user.google_id) return false;
        try {
            const backup = await drive.loadBackup();
            if (backup && backup.wrappedPrivateKey) {
                console.log("Found backup on Google Drive, syncing keys...");
                await importPrivateKey(backup.wrappedPrivateKey);
                setIsSetup(true);
                setHasKeyMismatch(false);
                return true;
            }
        } catch (err) {
            console.error("Auto-heal sync failed", err);
        }
        return false;
    }, [user.google_id, drive, importPrivateKey]);

    useEffect(() => {
        const checkKey = async () => {
            const hasKey = await hasLocalKey();
            if (hasKey) {
                setIsSetup(true);
                const localPub = await getLocalPublicKey();
                if (localPub && user.public_key && localPub !== user.public_key) {
                    console.warn("Local key mismatch detected!");
                    setHasKeyMismatch(true);
                }
                
                // Guard: Only upload the prekey bundle once per device session
                const storageKey = `monteeq_prekey_uploaded_${deviceId}`;
                if (localPub && token && !localStorage.getItem(storageKey)) {
                    try {
                        await uploadPrekeyBundle({
                            device_id: deviceId,
                            identity_key: localPub,
                            signed_prekey: localPub,
                            signature: "self-signed",
                            one_time_prekeys: [
                                "otk_" + Math.random().toString(36).substring(2, 15),
                                "otk_" + Math.random().toString(36).substring(2, 15)
                            ]
                        }, token);
                        localStorage.setItem(storageKey, 'true');
                    } catch (err) {
                        console.error("Failed to upload prekey bundle in background:", err);
                    }
                }
            } else if (user.google_id && drive.isAuthenticated) {
                const synced = await performDriveSync();
                if (synced) {
                    const now = new Date().toISOString();
                    setLastBackupTime(now);
                    localStorage.setItem('monteeq_last_backup_time', now);
                }
            }
            setIsInitialSync(false);
        };
        checkKey();
    }, [deviceId, token]);

    // Automatic Background Backup
    useEffect(() => {
        const autoBackup = async () => {
            if (isSetup && drive.isAuthenticated && user.public_key) {
                const lastPubKey = localStorage.getItem('monteeq_last_backup_pubkey');
                if (lastPubKey !== user.public_key) {
                    console.log("Triggering automatic cloud backup...");
                    const privKeyB64 = await exportPrivateKey();
                    if (privKeyB64) {
                        const now = new Date().toISOString();
                        await drive.saveBackup({ 
                            wrappedPrivateKey: privKeyB64, 
                            publicKey: user.public_key,
                            syncedAt: now 
                        });
                        setLastBackupTime(now);
                        localStorage.setItem('monteeq_last_backup_time', now);
                        localStorage.setItem('monteeq_last_backup_pubkey', user.public_key);
                    }
                }
            }
        };
        autoBackup();
    }, [isSetup, drive.isAuthenticated, user.public_key, drive.saveBackup, exportPrivateKey]);

    const fetchConversations = useCallback(async () => {
        try {
            const cached = await getLocalConversations();
            if (cached && cached.length > 0) {
                setConversations(prev => {
                    if (prev.length === cached.length && JSON.stringify(prev) === JSON.stringify(cached)) {
                        return prev;
                    }
                    return cached;
                });
                setIsConvsLoaded(true);
            }
            const data = await getConversations(token);
            if (Array.isArray(data)) {
                setConversations(prev => {
                    if (prev.length === data.length && JSON.stringify(prev) === JSON.stringify(data)) {
                        return prev;
                    }
                    return data;
                });
                setIsConvsLoaded(true);
                for (const c of data) {
                    await saveConversation(c);
                }
            } else {
                console.error('Invalid conversations data:', data);
            }
        } catch (error) {
            console.error('Failed to fetch conversations', error);
        }
    }, [token, getLocalConversations, saveConversation]);

    const updateConversationLastMessage = useCallback((msg) => {
        setConversations(prev => {
            const updated = prev.map(c => {
                if (c.id === msg.conversation_id) {
                    return {
                        ...c,
                        last_message: msg,
                        updated_at: msg.created_at
                    };
                }
                return c;
            });
            // Sort conversations so the active one goes to the top
            updated.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            return updated;
        });
    }, []);

    const fetchDiscoveryUsers = useCallback(async () => {
        try {
            const data = await getFollowing(user.username);
            setDiscoveryUsers(data);
        } catch (error) {
            console.error('Failed to fetch discovery users', error);
        }
    }, [user.username]);

    // Handle search in discovery mode
    useEffect(() => {
        const performSearch = async () => {
            if (!searchTerm.trim()) {
                if (isDiscoveryMode) fetchDiscoveryUsers();
                return;
            }
            
            try {
                const results = await searchUnified(searchTerm);
                if (isDiscoveryMode) {
                    setDiscoveryUsers(results.users || []);
                }
            } catch (err) {
                console.error("Search failed", err);
            }
        };

        const timeoutId = setTimeout(performSearch, 300);
        return () => clearTimeout(timeoutId);
    }, [searchTerm, isDiscoveryMode, fetchDiscoveryUsers]);

    // Handle deep-linking from profile
    useEffect(() => {
        if (location.state?.startChatWith && isConvsLoaded) {
            const targetUsername = location.state.startChatWith;
            const existing = conversations.find(c => 
                (c.user1.username === targetUsername) || (c.user2.username === targetUsername)
            );
            
            if (existing) {
                setSelectedConv(existing);
            } else {
                // Fetch user info to create a "virtual" conversation
                const setupVirtual = async () => {
                    try {
                        const results = await searchUnified(targetUsername);
                        const targetUser = (results.users || []).find(u => u.username === targetUsername);
                        if (targetUser) {
                            setSelectedConv({
                                id: 'virtual-' + Date.now(),
                                isVirtual: true,
                                user1: user,
                                user2: targetUser,
                                messages: []
                            });
                        }
                    } catch (err) {
                        console.error("Failed to setup virtual chat", err);
                    }
                };
                setupVirtual();
            }
            // Clear state so we don't re-trigger on every render
            window.history.replaceState({}, document.title);
        }
    }, [location.state, conversations, user]);

    const decryptAll = useCallback(async (msgs) => {
        if (!Array.isArray(msgs) || !user?.id || !isSetup) return;
        
        for (const msg of msgs) {
            // Only decrypt if we haven't done it and it's not currently in progress
            if (!decryptedMessages[msg.id] && !decryptionQueueRef.current.has(msg.id)) {
                decryptionQueueRef.current.add(msg.id);
                
                try {
                    const wrappedKey = String(msg.sender_id) === String(user.id) ? msg.sender_key : msg.recipient_key;
                    
                    if (msg.message_type === 'text') {
                        const decrypted = await decryptMessage(msg.encrypted_content, msg.iv, wrappedKey);
                        setDecryptedMessages(prev => ({ ...prev, [msg.id]: decrypted }));
                    } else {
                        setDecryptedMessages(prev => ({ ...prev, [msg.id]: `[${msg.message_type.toUpperCase()}]` }));
                    }
                } catch (e) {
                    console.error(`Message decryption failed for ID ${msg.id}:`, e.message);
                    setDecryptedMessages(prev => ({ ...prev, [msg.id]: '[Secure Message]' }));
                    
                    // Proactive detection: if unwrap fails, flag mismatch
                    if (e.message.includes('UNWRAP_FAILED')) {
                        setHasKeyMismatch(true);
                        
                        // AUTO-HEAL: Try to restore from drive if we haven't tried in the last 30s
                        const now = Date.now();
                        if (now - lastHealAttemptRef.current > 30000) {
                            lastHealAttemptRef.current = now;
                            console.log("Attempting background auto-heal...");
                            performDriveSync().then(success => {
                                if (success) {
                                    console.log("Auto-heal successful! Retrying decryption...");
                                    // Clear current conversation's decrypted states to force retry
                                    setDecryptedMessages({});
                                }
                            });
                        }
                    }
                } finally {
                    decryptionQueueRef.current.delete(msg.id);
                }
            }
        }
    }, [user.id, isSetup, decryptMessage]); // Removed decryptedMessages from deps to avoid re-runs

    const fetchMessages = useCallback(async (convId) => {
        if (!convId || String(convId).startsWith('virtual-')) return;
        try {
            const localMsgs = await getMessagesForConversation(convId);
            if (convId !== activeConvIdRef.current) return;
            setMessages(localMsgs);
            decryptAll(localMsgs);

            const remoteMsgs = await getChatMessages(convId, token);
            if (convId !== activeConvIdRef.current) return;

            if (Array.isArray(remoteMsgs) && remoteMsgs.length > 0) {
                for (const msg of remoteMsgs) {
                    await saveMessage(msg);
                }
                const updatedMsgs = await getMessagesForConversation(convId);
                if (convId !== activeConvIdRef.current) return;
                setMessages(updatedMsgs);
                decryptAll(updatedMsgs);

                const incomingIds = remoteMsgs
                    .filter(m => String(m.sender_id) !== String(user.id))
                    .map(m => m.id);
                    
                if (incomingIds.length > 0) {
                    try {
                        await acknowledgeMessages(incomingIds, token);
                    } catch (ackErr) {
                        console.error("Failed to acknowledge messages", ackErr);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages', error);
        }
    }, [token, decryptAll, getMessagesForConversation, saveMessage, user.id]);

    // WebSocket real-time message handler
    const handleWsMessage = useCallback((data) => {
        if (data.type === 'new_message' && data.message) {
            const msg = data.message;
            // Save to local DB
            saveMessage(msg).catch(() => {});
            
            // Update last message in the conversation list in the UI in background
            updateConversationLastMessage(msg);

            // If it's for the currently selected conversation, append it
            if (activeConvIdRef.current === msg.conversation_id) {
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    const updated = [...prev, msg];
                    updated.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                    return updated;
                });
                // Trigger decryption
                decryptAll([msg]);
            }
        }
    }, [saveMessage, decryptAll, updateConversationLastMessage]);

    const { isConnected: wsConnected } = useWebSocket(token, handleWsMessage);

    useEffect(() => {
        if (token && isSetup) {
            fetchConversations();
            // Only poll conversations list if WebSocket is offline
            if (!wsConnected) {
                const interval = setInterval(fetchConversations, 30000);
                return () => clearInterval(interval);
            }
        }
    }, [token, isSetup, fetchConversations, wsConnected]);

    useEffect(() => {
        if (selectedConv) {
            activeConvIdRef.current = selectedConv.id;
            setMessages([]);
            setDecryptedMessages({});
            
            if (!selectedConv.isVirtual) {
                fetchMessages(selectedConv.id);
                // Only poll fallback if WebSocket is disconnected
                if (!wsConnected) {
                    const interval = setInterval(() => fetchMessages(selectedConv.id), 5000);
                    return () => clearInterval(interval);
                }
            }
        } else {
            activeConvIdRef.current = null;
            setMessages([]);
            setDecryptedMessages({});
        }
    }, [selectedConv, fetchMessages, wsConnected]);

    const handleNukeKeys = async () => {
        if (window.confirm("WARNING: This will permanently delete your local workspace keys. If you don't have a backup on Google Drive, all your old messages will become unreadable. Proceed?")) {
            await nukeKeys();
            setIsSetup(false);
            setHasKeyMismatch(false);
            setDecryptedMessages({});
            window.location.reload(); // Hard reset for clean state
        }
    };

    const handleSetupKeys = async () => {
        const pubKey = await generateKeyPair();
        await uploadPublicKey(pubKey, token);
        try {
            await uploadPrekeyBundle({
                device_id: deviceId,
                identity_key: pubKey,
                signed_prekey: pubKey,
                signature: "self-signed",
                one_time_prekeys: [
                    "otk_" + Math.random().toString(36).substring(2, 15),
                    "otk_" + Math.random().toString(36).substring(2, 15)
                ]
            }, token);
        } catch (bundleErr) {
            console.error("Failed to upload prekey bundle", bundleErr);
        }
        setUser(prev => ({ ...prev, public_key: pubKey }));
        setIsSetup(true);
        
        // If Google user, backup the private key immediately
        if (user.google_id && drive.isAuthenticated) {
            const privKeyB64 = await exportPrivateKey();
            await drive.saveBackup({ wrappedPrivateKey: privKeyB64, syncedAt: new Date().toISOString() });
        }
    };

    const handleSendMessage = async (text) => {
        if (!selectedConv) return;
        const recipient = selectedConv.user1.username === user.username ? selectedConv.user2 : selectedConv.user1;
        
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const tempMsg = {
            id: tempId,
            conversation_id: selectedConv.id,
            sender_id: user.id,
            message_type: 'text',
            created_at: new Date().toISOString(),
            status: 'sending'
        };

        // Append optimistic message immediately
        setMessages(prev => [...prev, tempMsg]);
        setDecryptedMessages(prev => ({
            ...prev,
            [tempId]: text
        }));

        try {
            if (!user.public_key) {
                throw new Error("Workspace key missing. Please refresh or regenerate keys.");
            }

            let recipientBundles = [];
            try {
                recipientBundles = await getRecipientPrekeyBundles(recipient.username, token);
            } catch (_) {}

            let senderBundles = [];
            try {
                senderBundles = await getRecipientPrekeyBundles(user.username, token);
            } catch (_) {}

            let encrypted;
            if (recipientBundles && recipientBundles.length > 0) {
                if (!senderBundles.some(b => b.device_id === deviceId)) {
                    senderBundles.push({
                        device_id: deviceId,
                        identity_key: user.public_key
                    });
                }
                encrypted = await encryptMessageMultiDevice(text, recipientBundles, senderBundles);
            } else {
                const recipientKeys = await getUserPublicKey(recipient.username, token);
                if (!recipientKeys || !recipientKeys.public_key) {
                    throw new Error(`${recipient.username} hasn't initialized their workspace yet.`);
                }
                encrypted = await encryptMessage(text, recipientKeys.public_key, user.public_key);
            }
            
            const sentMsg = await sendChatMessage({
                ...encrypted,
                recipient_username: recipient.username,
                message_type: 'text'
            }, token);

            if (sentMsg) {
                await saveMessage(sentMsg);
                updateConversationLastMessage(sentMsg);
                
                // Replace temp message with real sent message
                setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
                setDecryptedMessages(prev => {
                    const next = { ...prev };
                    delete next[tempId];
                    next[sentMsg.id] = text;
                    return next;
                });
            }
            
            if (selectedConv.isVirtual) {
                await fetchConversations();
                const newConvs = await getConversations(token);
                const real = newConvs.find(c => 
                    (c.user1.username === recipient.username) || (c.user2.username === recipient.username)
                );
                if (real) setSelectedConv(real);
            }
        } catch (error) {
            console.error('Failed to send message', error);
            showNotification('error', error?.message || 'Transmission failed. Check connection or recipient keys.');
            
            // Mark message as failed
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        }
    };

    const encryptPayloadMultiDevice = async (arrayBuffer, recipientUsername) => {
        let recipientBundles = [];
        try {
            recipientBundles = await getRecipientPrekeyBundles(recipientUsername, token);
        } catch (_) {}

        let senderBundles = [];
        try {
            senderBundles = await getRecipientPrekeyBundles(user.username, token);
        } catch (_) {}

        if (recipientBundles && recipientBundles.length > 0) {
            if (!senderBundles.some(b => b.device_id === deviceId)) {
                senderBundles.push({
                    device_id: deviceId,
                    identity_key: user.public_key
                });
            }
            return encryptMultiDevice(arrayBuffer, recipientBundles, senderBundles);
        } else {
            const recipientKeys = await getUserPublicKey(recipientUsername, token);
            if (!recipientKeys || !recipientKeys.public_key) {
                throw new Error(`${recipientUsername} hasn't initialized their workspace yet.`);
            }
            return encryptBinary(arrayBuffer, recipientKeys.public_key, user.public_key);
        }
    };

    const handleSendVoice = async (blob) => {
        if (!selectedConv) return;
        const recipient = selectedConv.user1.username === user.username ? selectedConv.user2 : selectedConv.user1;
        
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const tempMsg = {
            id: tempId,
            conversation_id: selectedConv.id,
            sender_id: user.id,
            message_type: 'voice',
            created_at: new Date().toISOString(),
            status: 'sending'
        };

        // Append optimistic voice message
        setMessages(prev => [...prev, tempMsg]);
        
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const encrypted = await encryptPayloadMultiDevice(arrayBuffer, recipient.username);
            
            const encryptedBlob = new Blob([base64ToArrayBuffer(encrypted.encrypted_content)], { type: 'application/octet-stream' });
            const uploadRes = await uploadChatAttachment(encryptedBlob, token);
            
            const sentMsg = await sendChatMessage({
                ...encrypted,
                encrypted_content: 'ENCRYPTED_VOICE',
                recipient_username: recipient.username,
                message_type: 'voice',
                attachment_url: uploadRes.url,
                file_metadata: JSON.stringify({ size: blob.size, type: blob.type })
            }, token);
            
            if (sentMsg) {
                await saveMessage(sentMsg);
                updateConversationLastMessage(sentMsg);
                
                // Replace temp message with real sent message
                setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
                decryptAll([sentMsg]);
            }
        } catch (err) {
            console.error("Voice send failed", err);
            showNotification('error', err?.message || 'Failed to send voice recording');
            
            // Mark message as failed
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        }
    };

    const handleUploadFile = async (file) => {
        if (!selectedConv || !file) return;
        const recipient = selectedConv.user1.username === user.username ? selectedConv.user2 : selectedConv.user1;
        
        let message_type = 'file';
        if (file.type.startsWith('image/')) message_type = 'image';
        else if (file.type.startsWith('video/')) message_type = 'video';

        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const tempMsg = {
            id: tempId,
            conversation_id: selectedConv.id,
            sender_id: user.id,
            message_type: message_type,
            created_at: new Date().toISOString(),
            status: 'sending'
        };

        // Append optimistic file/image/video message
        setMessages(prev => [...prev, tempMsg]);
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const encrypted = await encryptPayloadMultiDevice(arrayBuffer, recipient.username);
            
            const encryptedBlob = new Blob([base64ToArrayBuffer(encrypted.encrypted_content)], { type: 'application/octet-stream' });
            const uploadRes = await uploadChatAttachment(encryptedBlob, token);
            
            const sentMsg = await sendChatMessage({
                ...encrypted,
                encrypted_content: 'ENCRYPTED_FILE',
                recipient_username: recipient.username,
                message_type: message_type,
                attachment_url: uploadRes.url,
                file_metadata: JSON.stringify({ name: file.name, size: file.size, type: file.type })
            }, token);
            
            if (sentMsg) {
                await saveMessage(sentMsg);
                updateConversationLastMessage(sentMsg);
                
                // Replace temp message with real sent message
                setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
                decryptAll([sentMsg]);
            }
        } catch (err) {
            console.error("File upload failed", err);
            showNotification('error', err?.message || 'Failed to upload file');
            
            // Mark message as failed
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
        }
    };

    const handleDownloadFile = async (msg) => {
        try {
            const response = await fetch(msg.attachment_url);
            const encryptedBuffer = await response.arrayBuffer();
            const encryptedB64 = arrayBufferToBase64(encryptedBuffer);
            
            const wrappedKey = String(msg.sender_id) === String(user.id) ? msg.sender_key : msg.recipient_key;
            const decryptedBuffer = await decryptBinary(encryptedB64, msg.iv, wrappedKey);
            
            const metadata = JSON.parse(msg.file_metadata);
            const blob = new Blob([decryptedBuffer], { type: metadata.type });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = metadata.name || 'download';
            a.click();
        } catch (err) {
            console.error("File download/decrypt failed", err);
        }
    };

    // Helper functions for base64 (already in useCrypto but re-declared here for handle logic if needed or just use useCrypto ones)
    const arrayBufferToBase64 = (buffer) => {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };

    const base64ToArrayBuffer = (base64) => {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    if (isInitialSync) return <div className="chatWorkspace-loading">Initializing Elite Workspace...</div>;

    if (!isSetup) {
        return (
            <div className="chat-setup-container">
                <div className="glass setup-card">
                    <h2>E2E Encryption Required</h2>
                    <p>To access the Monteeq workspace, you must generate your unique client-side encryption key.</p>
                    <button className="primary-btn" onClick={handleSetupKeys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <Key size={20} />
                        GENERATE WORKSPACE KEY
                    </button>
                    {user.google_id && !drive.isAuthenticated && (
                        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Logged in with Google? Your keys will be automatically synced.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    const handleSelectChat = (item, isUser = false) => {
        if (isUser) {
            // Initiate virtual conversation
            setSelectedConv({
                id: 'virtual-' + Date.now(),
                isVirtual: true,
                user1: user,
                user2: item,
                messages: []
            });
            setIsDiscoveryMode(false);
            setSearchTerm('');
        } else {
            setSelectedConv(item);
        }
    };

    const failedCount = Object.values(decryptedMessages).filter(v => v === '[Secure Message]').length;

    return (
        <div className={`chatWorkspace ${selectedConv ? 'chat-open' : ''}`}>
            {/* Primary Navigation Rail */}
            <div className="nav-rail">
                <div className="nav-rail-top">
                    <div className="nav-rail-logo">
                        <div className="nav-rail-logo-mark">
                            <img src={logo} alt="Monteeq" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                        <span className="nav-rail-logo-text">Monteeq</span>
                    </div>

                    <button
                        className={`nav-rail-btn ${!isDiscoveryMode ? 'active' : ''}`}
                        onClick={() => { setIsDiscoveryMode(false); setSelectedConv(null); }}
                    >
                        <MessageSquare size={26} />
                        Sessions
                    </button>

                    <button
                        className={`nav-rail-btn ${isDiscoveryMode ? 'active' : ''}`}
                        onClick={() => { setIsDiscoveryMode(true); fetchDiscoveryUsers(); }}
                    >
                        <UserPlus size={26} />
                        Discover
                    </button>

                    <div className="nav-rail-divider" />

                    <button
                        className={`nav-rail-btn ${hasKeyMismatch ? 'security-alert' : 'security-ok'}`}
                        onClick={() => setShowSecurityPortal(true)}
                    >
                        {hasKeyMismatch ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}
                        {hasKeyMismatch ? 'Key Desync' : 'Encrypted'}
                    </button>
                </div>

                <div className="nav-rail-bottom">
                    <div className="nav-rail-avatar-row">
                        <div className="nav-rail-avatar">
                            {user.profile_pic 
                                ? <img src={user.profile_pic} alt="avatar" />
                                : (user.name || user.username || 'U')[0].toUpperCase()
                            }
                        </div>
                        <div className="nav-rail-user-info">
                            <div className="nav-rail-username">{user.username || user.name}</div>
                            <div className="nav-rail-role">Creator</div>
                        </div>
                    </div>
                </div>
            </div>

            <ChatList 
                conversations={conversations} 
                discoveryUsers={discoveryUsers}
                isDiscoveryMode={isDiscoveryMode}
                onToggleDiscovery={(val) => {
                    setIsDiscoveryMode(val);
                    if (val) fetchDiscoveryUsers();
                }}
                selectedId={selectedConv?.id}
                onSelect={handleSelectChat}
                user={user}
                searchTerm={searchTerm}
                onSearch={setSearchTerm}
            />
            <ChatWindow 
                selectedConv={selectedConv}
                messages={messages}
                decryptedMessages={decryptedMessages}
                user={user}
                onSendMessage={handleSendMessage}
                onSendVoice={handleSendVoice}
                onUploadFile={handleUploadFile}
                onDownloadFile={handleDownloadFile}
                onBack={() => setSelectedConv(null)}
                decryptBinary={decryptBinary}
                wsConnected={wsConnected}
            />

            <AnimatePresence>
                {showSecurityPortal && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="security-portal-overlay"
                        onClick={() => setShowSecurityPortal(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="security-portal-card"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="portal-header">
                                <ShieldCheck size={32} color={hasKeyMismatch ? "var(--neon-red)" : "#34c759"} />
                                <h3>Security Portal</h3>
                            </div>
                            
                            <div className="portal-body">
                                <p className="portal-desc">
                                    {hasKeyMismatch 
                                        ? `CRITICAL: ${failedCount} message${failedCount === 1 ? '' : 's'} could not be deciphered because your local keys do not match the cloud profile.`
                                        : "Your session is fully encrypted and synced with your cloud profile."}
                                </p>

                                <div className="portal-actions">
                                    <button 
                                        className={`portal-btn sync-btn ${hasKeyMismatch && drive.isAuthenticated ? 'suggested' : ''}`} 
                                        onClick={performDriveSync}
                                    >
                                        <Cloud size={18} />
                                        <span>Restore from Drive</span>
                                        {hasKeyMismatch && drive.isAuthenticated && <span className="btn-badge">RECOMMENDED</span>}
                                    </button>
                                    
                                    <div className="portal-divider">OR</div>

                                    <button className="portal-btn reset-btn" onClick={handleNukeKeys}>
                                        <Zap size={18} />
                                        <span>Emergency Session Reset</span>
                                    </button>
                                </div>
                                
                                <div className="portal-footer-sync">
                                    <div className={`sync-dot ${drive.isAuthenticated ? 'active' : ''}`} />
                                    <span>Cloud Sync: {drive.isAuthenticated ? 'ACTIVE' : 'NOT LINKED'}</span>
                                    {lastBackupTime && (
                                        <span className="last-sync-time">
                                            (Last backup: {new Date(lastBackupTime).toLocaleTimeString()})
                                        </span>
                                    )}
                                </div>
                                
                                {hasKeyMismatch && (
                                    <div className="portal-warning">
                                        <ShieldAlert size={14} />
                                        <span>Resetting will make old unreadable messages permanent.</span>
                                    </div>
                                )}
                            </div>

                            <button className="portal-close" onClick={() => setShowSecurityPortal(false)}>
                                CLOSE PORTAL
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


        </div>
    );
};

export default Chat;
