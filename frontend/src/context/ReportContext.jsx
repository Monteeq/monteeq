import React, { createContext, useContext, useState } from 'react';
import ReportModal from '../components/ReportModal';

const ReportContext = createContext(null);

export const ReportProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [contentType, setContentType] = useState('');
    const [contentId, setContentId] = useState('');

    const openReportModal = (type, id) => {
        setContentType(type);
        setContentId(id);
        setIsOpen(true);
    };

    const closeReportModal = () => {
        setIsOpen(false);
        setContentType('');
        setContentId('');
    };

    return (
        <ReportContext.Provider value={{ openReportModal, closeReportModal }}>
            {children}
            {isOpen && (
                <ReportModal 
                    contentType={contentType} 
                    contentId={contentId} 
                    onClose={closeReportModal} 
                />
            )}
        </ReportContext.Provider>
    );
};

export const useReport = () => {
    const context = useContext(ReportContext);
    if (!context) {
        throw new Error('useReport must be used within a ReportProvider');
    }
    return context;
};
