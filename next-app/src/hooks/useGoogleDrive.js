'use client';

import { useState, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const BACKUP_FILENAME = 'monteeq_chat_backup_v2.json';

export const useGoogleDrive = (onSuccess) => {
    const [accessToken, setAccessToken] = useState(localStorage.getItem('google_drive_token'));
    const [isSyncing, setIsSyncing] = useState(false);

    const login = useGoogleLogin({
        onSuccess: (tokenResponse) => {
            setAccessToken(tokenResponse.access_token);
            localStorage.setItem('google_drive_token', tokenResponse.access_token);
            if (onSuccess) onSuccess(tokenResponse.access_token);
        },
        scope: 'https://www.googleapis.com/auth/drive.file',
    });

    const findBackupFile = useCallback(async (token) => {
        const query = `name = '${BACKUP_FILENAME}' and trashed = false`;
        const response = await axios.get('https://www.googleapis.com/drive/v3/files', {
            params: { q: query, spaces: 'drive', fields: 'files(id, name)' },
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.files[0];
    }, []);

    const saveBackup = useCallback(async (data) => {
        if (!accessToken) return;
        setIsSyncing(true);
        try {
            const file = await findBackupFile(accessToken);
            const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            
            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', blob);

            if (file) {
                // Update
                await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=multipart`, formData, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
            } else {
                // Create
                await axios.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', formData, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
            }
        } catch (err) {
            console.error("Backup failed", err);
        } finally {
            setIsSyncing(false);
        }
    }, [accessToken, findBackupFile]);

    const loadBackup = useCallback(async () => {
        if (!accessToken) return null;
        try {
            const file = await findBackupFile(accessToken);
            if (!file) return null;

            const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return response.data;
        } catch (err) {
            console.error("Failed to load backup", err);
            return null;
        }
    }, [accessToken, findBackupFile]);

    return {
        login,
        saveBackup,
        loadBackup,
        isSyncing,
        isAuthenticated: !!accessToken
    };
};
