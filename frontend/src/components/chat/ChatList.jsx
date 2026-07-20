import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare } from 'lucide-react';

const ChatList = ({
    conversations,
    discoveryUsers,
    isDiscoveryMode,
    onToggleDiscovery,
    selectedId,
    onSelect,
    user,
    onSearch,
    searchTerm,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="chatSidebar"
        >
            <div className="sidebarHeader">
                <h2 style={{ marginBottom: '1.2rem' }}>
                    {isDiscoveryMode ? 'Discover' : 'Sessions'}
                </h2>

                <div className="searchBox">
                    <Search size={26} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={isDiscoveryMode ? "FIND CREATORS..." : "SEARCH SESSIONS..."}
                        value={searchTerm}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="conversation-list" style={{ flex: 1, overflowY: 'auto' }}>
                <AnimatePresence mode="popLayout">
                    {isDiscoveryMode ? (
                        discoveryUsers.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-chat-list">
                                <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>NO CREATORS FOUND</p>
                            </motion.div>
                        ) : (
                            discoveryUsers.map((u, i) => (
                                <motion.div
                                    key={u.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="conversation-item-v2"
                                    onClick={() => onSelect(u, true)}
                                >
                                    <div className="avatar-lg">
                                        {u.profile_pic ? <img src={u.profile_pic} alt="" /> : u.username[0].toUpperCase()}
                                    </div>
                                    <div className="conv-details">
                                        <div className="conv-header">
                                            <span className="partner-name">{u.username}</span>
                                        </div>
                                        <p className="last-message">@{u.username}</p>
                                    </div>
                                </motion.div>
                            ))
                        )
                    ) : (
                        conversations.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="empty-chat-list"
                            >
                                <MessageSquare size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>NO ACTIVE SESSIONS</p>
                            </motion.div>
                        ) : (
                            conversations.map((conv, i) => {
                                const partner = conv.user1.username === user.username ? conv.user2 : conv.user1;
                                const isActive = selectedId === conv.id;

                                return (
                                    <motion.div
                                        key={conv.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ delay: i * 0.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`conversation-item-v2 ${isActive ? 'active' : ''}`}
                                        onClick={() => onSelect(conv)}
                                    >
                                        <div className="avatar-wrapper">
                                            <div className="avatar-lg">
                                                {partner.profile_pic ? (
                                                    <img src={partner.profile_pic} alt="" />
                                                ) : (
                                                    partner.username[0].toUpperCase()
                                                )}
                                            </div>
                                            <motion.span
                                                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="status-dot"
                                            />
                                        </div>
                                        <div className="conv-details">
                                            <div className="conv-header">
                                                <span className="partner-name">{partner.username}</span>
                                                <span className="last-seen">12:30 PM</span>
                                            </div>
                                            <p className="last-message">Secure chat session active</p>
                                        </div>
                                        {isActive && (
                                            <motion.div
                                                layoutId="active-indicator"
                                                style={{ position: 'absolute', right: 0, width: '4px', height: '60%', background: 'var(--neon-red)', borderRadius: '2px 0 0 2px' }}
                                            />
                                        )}
                                    </motion.div>
                                );
                            })
                        )
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default ChatList;
