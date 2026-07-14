'use client';

import React, { useEffect } from 'react';

/**
 * Manual SEO Component (Fallback for environments without react-helmet)
 * Handles Title, Meta Tags, and JSON-LD Structured Data
 */
const SEO = ({
    title,
    description,
    video,
    canonical,
    ogImage,
    ogType = "video.other"
}) => {
    const siteName = "Monteeq";
    const fullTitle = `${title} | ${siteName}`;
    const url = canonical || window.location.href;

    useEffect(() => {
        // 1. Update Title
        document.title = fullTitle;

        // 2. Helper to set/update meta tags
        const setMeta = (property, content, attr = "name") => {
            if (!content) return;
            let el = document.querySelector(`meta[${attr}="${property}"]`);
            if (el) {
                el.setAttribute("content", content);
            } else {
                el = document.createElement("meta");
                el.setAttribute(attr, property);
                el.setAttribute("content", content);
                document.head.appendChild(el);
            }
        };

        // Standard Meta
        setMeta("description", description);
        setMeta("robots", "index, follow");

        // Open Graph
        setMeta("og:title", fullTitle, "property");
        setMeta("og:description", description, "property");
        setMeta("og:type", ogType, "property");
        setMeta("og:url", url, "property");
        setMeta("og:site_name", siteName, "property");
        if (ogImage) setMeta("og:image", ogImage, "property");

        // Twitter
        setMeta("twitter:card", "summary_large_image");
        setMeta("twitter:title", fullTitle);
        setMeta("twitter:description", description);
        if (ogImage) setMeta("twitter:image", ogImage);

        // 3. Structured Data (JSON-LD)
        if (video) {
            const schema = {
                "@context": "https://schema.org",
                "@type": "VideoObject",
                "name": title,
                "description": description,
                "thumbnailUrl": [video.thumbnail_url],
                "uploadDate": video.created_at,
                "duration": video.duration ? `PT${Math.floor(video.duration / 60)}M${video.duration % 60}S` : "PT1M30S",
                "contentUrl": video.video_url,
                "embedUrl": `${window.location.origin}/embed/${video.id}`,
                "interactionStatistic": {
                    "@type": "InteractionCounter",
                    "interactionType": { "@type": "WatchAction" },
                    "userInteractionCount": video.views || 0
                }
            };

            let script = document.getElementById("json-ld-seo");
            if (!script) {
                script = document.createElement("script");
                script.id = "json-ld-seo";
                script.type = "application/ld+json";
                document.head.appendChild(script);
            }
            script.text = JSON.stringify(schema);
        } else {
            // Organization schema for home/generic pages
            const orgSchema = {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Monteeq",
                "url": window.location.origin,
                "logo": `${window.location.origin}/favicon.png`,
                "sameAs": [
                    "https://twitter.com/monteeq",
                    "https://instagram.com/monteeq"
                ]
            };
            let script = document.getElementById("json-ld-seo-org");
            if (!script) {
                script = document.createElement("script");
                script.id = "json-ld-seo-org";
                script.type = "application/ld+json";
                document.head.appendChild(script);
            }
            script.text = JSON.stringify(orgSchema);
        }

        // Cleanup (optional, but good for SPA)
        return () => {
            // We don't necessarily want to remove meta on every unmount in some cases
            // but for structured data we should
            const script = document.getElementById("json-ld-seo");
            if (script) script.remove();
            const orgScript = document.getElementById("json-ld-seo-org");
            if (orgScript) orgScript.remove();
        };
    }, [fullTitle, description, video, ogImage, ogType, url]);

    return null; // This component doesn't render anything UI-wise
};

export default SEO;
