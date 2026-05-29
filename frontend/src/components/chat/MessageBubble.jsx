import React, { useState, useRef } from 'react';
import { FileIcon, Download, Play, Pause, Shield, Lock, CheckCheck, FileText, FileArchive, Image as ImageIcon, Video } from 'lucide-react';
import ChatVideoPlayer from './ChatVideoPlayer';

const MessageBubble = ({ message, isSent, sender, decryptedContent, onDownloadFile, decryptBinary }) => {
    const [isVoicePlaying, setIsVoicePlaying] = useState(false);
    const [audioUrl, setAudioUrl] = useState(null);
    const [mediaUrl, setMediaUrl] = useState(null);
    const [isMediaLoading, setIsMediaLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const audioRef = useRef(null);

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    React.useEffect(() => {
        if ((message.message_type === 'image' || message.message_type === 'video') && !mediaUrl && !isMediaLoading) {
            handleDecipherMedia();
        }
    }, [message.message_type]);

    const handleDecipherMedia = async () => {
        setIsMediaLoading(true);
        try {
            const response = await fetch(message.attachment_url);
            const encryptedBuffer = await response.arrayBuffer();
            
            const arrayBufferToBase64 = (buffer) => {
                let binary = '';
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return window.btoa(binary);
            };

            const encryptedB64 = arrayBufferToBase64(encryptedBuffer);
            const wrappedKey = isSent ? message.sender_key : message.recipient_key;
            
            const decryptedBuffer = await decryptBinary(encryptedB64, message.iv, wrappedKey);
            const typeMap = { 'image': 'image/jpeg', 'video': 'video/mp4' };
            const decryptedBlob = new Blob([decryptedBuffer], { type: typeMap[message.message_type] || 'application/octet-stream' });
            
            const url = URL.createObjectURL(decryptedBlob);
            setMediaUrl(url);
        } catch (err) {
            console.error("Media decryption failed", err);
        } finally {
            setIsMediaLoading(false);
        }
    };

    const handlePlayVoice = async () => {
        if (isVoicePlaying) {
            audioRef.current.pause();
            setIsVoicePlaying(false);
            return;
        }

        if (!audioUrl) {
            try {
                const response = await fetch(message.attachment_url);
                const encryptedBuffer = await response.arrayBuffer();
                
                // Helper to convert buffer to base64
                const arrayBufferToBase64 = (buffer) => {
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return window.btoa(binary);
                };

                const encryptedB64 = arrayBufferToBase64(encryptedBuffer);
                const wrappedKey = isSent ? message.sender_key : message.recipient_key;
                
                const decryptedBuffer = await decryptBinary(encryptedB64, message.iv, wrappedKey);
                const decryptedBlob = new Blob([decryptedBuffer], { type: 'audio/webm' });
                
                const url = URL.createObjectURL(decryptedBlob);
                setAudioUrl(url);
                const audio = new Audio(url);
                
                audio.onloadedmetadata = () => setDuration(audio.duration);
                audio.ontimeupdate = () => setProgress((audio.currentTime / audio.duration) * 100);
                audio.onended = () => {
                    setIsVoicePlaying(false);
                    setProgress(0);
                };
                
                audioRef.current = audio;
            } catch (err) {
                console.error("Failed to play voice", err);
                return;
            }
        }

        if (isVoicePlaying) {
            audioRef.current.pause();
            setIsVoicePlaying(false);
        } else {
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.play();
            setIsVoicePlaying(true);
        }
    };

    const togglePlaybackSpeed = () => {
        const speeds = [1, 1.5, 2];
        const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
        setPlaybackSpeed(nextSpeed);
        if (audioRef.current) {
            audioRef.current.playbackRate = nextSpeed;
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderContent = () => {
        if (!decryptedContent) return (
            <div className="deciphering-mode">
                <Lock size={14} />
                <span>DECIPHERING ENCRYPTED DATA...</span>
            </div>
        );

        switch (message.message_type) {
            case 'voice':
                return (
                    <div className="voice-message-v3">
                        <div className="v3-voice-main">
                            <div className="v3-avatar-play">
                                <div className="v3-mini-avatar">
                                    {sender?.profile_pic ? (
                                        <img src={sender.profile_pic} alt="" />
                                    ) : (
                                        <div className="v3-initials">{sender?.username?.[0]?.toUpperCase()}</div>
                                    )}
                                    <button className="v3-play-btn" onClick={handlePlayVoice}>
                                        {isVoicePlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" style={{ marginLeft: '2px' }} />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="v3-waveform-area">
                                <div className="v3-waveform-bg">
                                    <div 
                                        className="v3-waveform-progress" 
                                        style={{ width: `${progress}%` }} 
                                    />
                                    {/* Stylized waveform bars */}
                                    <div className="v3-bars">
                                        {[...Array(20)].map((_, i) => (
                                            <span key={i} style={{ height: `${20 + Math.random() * 60}%` }} />
                                        ))}
                                    </div>
                                </div>
                                <div className="v3-meta">
                                    <span className="v3-duration">
                                        {isVoicePlaying ? formatDuration(audioRef.current?.currentTime) : formatDuration(duration)}
                                    </span>
                                    <button className="v3-speed-btn" onClick={togglePlaybackSpeed}>
                                        {playbackSpeed}x
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'file':
                const metadata = message.file_metadata ? JSON.parse(message.file_metadata) : {};
                const getFileIcon = (name = '') => {
                    const ext = name.split('.').pop().toLowerCase();
                    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) return <FileText size={20} />;
                    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <FileArchive size={20} />;
                    return <FileIcon size={20} />;
                };
                return (
                    <div className="file-box-v2" onClick={() => onDownloadFile(message)}>
                        <div className="v2-file-icon">
                            {getFileIcon(metadata.name)}
                        </div>
                        <div className="v2-file-info">
                            <span className="v2-filename">{metadata.name || 'DATA_OBJECT'}</span>
                            <span className="v2-filesize">{metadata.size ? `${(metadata.size / 1024).toFixed(1)} KB` : ''}</span>
                        </div>
                        <Download size={16} />
                    </div>
                );
            case 'image':
                return (
                    <div className="image-preview-v2">
                        {mediaUrl ? (
                            <img src={mediaUrl} alt="Preview" className="media-preview" />
                        ) : (
                            <div className="media-placeholder">
                                <ImageIcon size={32} className="spinning" />
                                <span>AUTHENTICATING IMAGE...</span>
                            </div>
                        )}
                    </div>
                );
            case 'video':
                return (
                    <div className="media-attachment-container">
                        {mediaUrl ? (
                            <ChatVideoPlayer src={mediaUrl} />
                        ) : (
                            <div className="media-placeholder">
                                <Video size={32} className="spinning" />
                                <span>DECRYPTING VIDEO STREAM...</span>
                            </div>
                        )}
                    </div>
                );
            default:
                return <p className="v2-text-content">{decryptedContent}</p>;
        }
    };

    return (
        <div className={`messageBubble ${isSent ? 'sent' : 'received'}`}>
            <div className="bubble-content">
                {renderContent()}
            </div>
            <div className="bubble-footer">
                <span className="message-time">{formatTime(message.created_at)}</span>
                {isSent && (
                    <div className="status-ticks">
                        <CheckCheck size={14} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageBubble;
