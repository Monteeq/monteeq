import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, MoreVertical, ChevronLeft, Mic, Cpu, Users, Activity, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import VoiceRecorder from './VoiceRecorder';

const ChatWindow = ({ 
    selectedConv, 
    messages, 
    decryptedMessages, 
    user, 
    onSendMessage, 
    onSendVoice, 
    onUploadFile,
    onDownloadFile,
    onBack,
    decryptBinary,
    wsConnected = false
}) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const lastScrollConvId = useRef(null);
    const prevMsgCount = useRef(0);
    const prevLastMsgId = useRef(null);

    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        if (!selectedConv) return;
        
        const container = containerRef.current;
        if (!container) return;

        // Force instant scroll to bottom on initial conversation load
        if (lastScrollConvId.current !== selectedConv.id) {
            lastScrollConvId.current = selectedConv.id;
            prevMsgCount.current = messages.length;
            prevLastMsgId.current = messages[messages.length - 1]?.id;
            setTimeout(() => scrollToBottom('auto'), 50);
            return;
        }

        const currentMsgCount = messages.length;
        const currentLastMsgId = messages[messages.length - 1]?.id;

        // Only evaluate scrolling if a new message was actually appended
        if (currentMsgCount > prevMsgCount.current || currentLastMsgId !== prevLastMsgId.current) {
            const threshold = 150;
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
            
            const lastMessage = messages[messages.length - 1];
            const sentByMe = lastMessage && lastMessage.sender_id === user.id;

            if (isNearBottom || sentByMe) {
                scrollToBottom('smooth');
            }
        }

        // Update refs for next render
        prevMsgCount.current = currentMsgCount;
        prevLastMsgId.current = currentLastMsgId;
    }, [messages, selectedConv, user.id]);

    const handleSendText = (e) => {
        if (e) e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage);
            setNewMessage('');
        }
    };

    if (!selectedConv) {
        return (
            <div className="chatEmptyState">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="hub-home-content"
                    style={{ zIndex: 10, position: 'relative' }}
                >
                    <div style={{ marginBottom: '1rem', color: 'var(--neon-red)' }}>
                        <Zap size={48} fill="currentColor" />
                    </div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Messages</h2>
                    <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '3rem' }}>Private messages between editors</p>

                    <div className="hub-home-card">
                        <div className="hub-stat-item">
                            <Activity size={32} color="var(--neon-red)" />
                            <h4>Active Sessions</h4>
                            <div className="val">{messages?.length > 0 ? '1' : '0'}</div>
                        </div>
                        <div className="hub-stat-item">
                            <Users size={32} color="#fff" />
                            <h4>Collaborators</h4>
                            <div className="val">{[...new Set(messages?.map(m => m.sender_id))].length || 0}</div>
                        </div>
                        <div className="hub-stat-item">
                            <ShieldCheck size={32} color="#34c759" />
                            <h4>Encryption</h4>
                            <div className="val">E2EE</div>
                        </div>
                    </div>

                    <div style={{ marginTop: '4rem', opacity: 0.5, fontFamily: 'Space Mono', fontSize: '0.8rem' }}>
                        SYSTEM STATUS: SECURE | CONNECTION: OPTIMIZED
                    </div>
                </motion.div>
                
                {/* Visual flair for the home screen */}
                <div style={{ position: 'absolute', top: '20%', left: '10%', opacity: 0.05 }}><Cpu size={120} /></div>
                <div style={{ position: 'absolute', bottom: '15%', right: '10%', opacity: 0.05 }}><Zap size={100} /></div>
            </div>
        );
    }

    const partner = selectedConv.user1.username === user.username ? selectedConv.user2 : selectedConv.user1;

    return (
        <div className="chatMain">
            <div className="chatHeader">
                <div className="mobile-back-chat" onClick={onBack}>
                    <ChevronLeft size={28} />
                </div>
                <div className="avatar-md" style={{ border: '2px solid rgba(235, 0, 0, 0.2)' }}>
                    {partner.profile_pic ? <img src={partner.profile_pic} alt="" /> : partner.username[0].toUpperCase()}
                    <div className="status-dot" style={{ width: '10px', height: '10px', bottom: '0', right: '0' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div className="partner-name" style={{ fontSize: '1.1rem' }}>{partner.username}</div>
                    <div className="partner-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', background: 'var(--neon-red)', borderRadius: '50%', boxShadow: 'var(--neon-glow)' }}></span>
                        SECURE SESSION ACTIVE
                    </div>
                </div>
                    <div className="ws-status-indicator">
                        <span className={`ws-dot ${wsConnected ? 'connected' : ''}`}></span>
                        {wsConnected ? 'LIVE' : 'POLL'}
                    </div>
                    <span className="encryption-badge">
                        <ShieldCheck size={10} />
                        E2EE
                    </span>
                    <div className="headerActions">
                        <MoreVertical size={32} className="header-more-btn" />
                    </div>
            </div>

            <div className="messagesContainer" ref={containerRef}>
                <AnimatePresence initial={false}>
                    {Array.isArray(messages) && messages.map((msg, i) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`message-bubble-wrapper ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                        >
                            <MessageBubble 
                                message={msg}
                                isSent={msg.sender_id === user.id}
                                sender={msg.sender_id === user.id ? user : (selectedConv.user1.id === msg.sender_id ? selectedConv.user1 : selectedConv.user2)}
                                decryptedContent={decryptedMessages[msg.id]}
                                onDownloadFile={onDownloadFile}
                                decryptBinary={decryptBinary}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            <div className="inputArea">
                <div className="inputWrapper">
                    <label className="actionBtn">
                        <Paperclip size={28} />
                        <input 
                            type="file" 
                            style={{ display: 'none' }} 
                            onChange={(e) => onUploadFile(e.target.files[0])} 
                        />
                    </label>
                    <form onSubmit={handleSendText} style={{ flex: 1, display: 'flex' }}>
                        <input 
                            type="text" 
                            placeholder="TRANSMIT SECURE DATA..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                    </form>
                    <div className="inputActions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <VoiceRecorder onSendVoice={onSendVoice} />
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="btn-primary-neon" 
                            onClick={handleSendText}
                        >
                            <Send size={28} />
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
