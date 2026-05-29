import React, { useState, useRef } from 'react';
import { Mic, Square, Send, Trash2, Play, Pause } from 'lucide-react';

const VoiceRecorder = ({ onSendVoice }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const audioPreviewRef = useRef(null);

    const startRecording = async () => {
        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (constraintErr) {
                console.warn("High quality constraints failed, falling back to basic audio stream", constraintErr);
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { mimeType: 'audio/webm' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            }

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: options.mimeType || 'audio/ogg' });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Camera/Mic access denied", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSend = () => {
        if (audioBlob) {
            onSendVoice(audioBlob);
            setAudioBlob(null);
            setPreviewUrl(null);
            setRecordingTime(0);
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
                audioPreviewRef.current = null;
            }
            setIsPreviewPlaying(false);
        }
    };

    const handleDiscard = () => {
        if (audioPreviewRef.current) {
            audioPreviewRef.current.pause();
            audioPreviewRef.current = null;
        }
        setAudioBlob(null);
        setPreviewUrl(null);
        setRecordingTime(0);
        setIsPreviewPlaying(false);
    };

    const handlePreviewPlay = () => {
        if (isPreviewPlaying) {
            audioPreviewRef.current.pause();
            setIsPreviewPlaying(false);
        } else {
            if (!audioPreviewRef.current) {
                audioPreviewRef.current = new Audio(previewUrl);
                audioPreviewRef.current.onended = () => setIsPreviewPlaying(false);
            }
            audioPreviewRef.current.play();
            setIsPreviewPlaying(true);
        }
    };

    return (
        <div className="voice-recorder-overlay">
            {!isRecording && !audioBlob ? (
                <button className="btn-primary-neon" onClick={startRecording}>
                    <Mic size={24} />
                </button>
            ) : isRecording ? (
                <div className="recording-status">
                    <span className="rec-indicator"></span>
                    <span className="time">{formatTime(recordingTime)}</span>
                    <button className="btn-primary-neon" onClick={stopRecording}>
                        <Square size={24} fill="white" />
                    </button>
                </div>
            ) : (
                <div className="review-status">
                    <button className="actionBtn" onClick={handleDiscard}>
                        <Trash2 size={24} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button className="actionBtn" onClick={handlePreviewPlay}>
                            {isPreviewPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <span className="time">{formatTime(recordingTime)} (Review)</span>
                    </div>
                    <button className="btn-primary-neon" onClick={handleSend}>
                        <Send size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default VoiceRecorder;
