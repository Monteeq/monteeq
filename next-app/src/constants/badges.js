import { Upload, Eye, Zap, UserPlus, Users, Award, Heart, Flame } from 'lucide-react';

export const BADGES = [
    { id: 'FIRST_UPLOAD', name: 'First Upload', description: 'Uploaded your first video', icon: Upload },
    { id: '100_VIEWS', name: '100 Views', description: 'Reached 100 total views', icon: Eye },
    { id: '1000_VIEWS', name: '1k Club', description: 'Reached 1,000 total views', icon: Zap },
    { id: 'FIRST_FOLLOWER', name: 'First Follower', description: 'Gained your first follower', icon: UserPlus },
    { id: '100_FOLLOWERS', name: 'Community Builder', description: 'Reached 100 followers', icon: Users },
    { id: '1K_FOLLOWERS', name: 'Influencer', description: 'Reached 1,000 followers', icon: Award },
    { id: '5_LIKES', name: 'High Five', description: 'Received 5 likes on a video', icon: Heart },
    { id: 'TRENDING', name: 'Trending', description: 'Had a video appear in the trending section', icon: Flame },
];
