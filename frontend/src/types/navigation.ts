import { NavigatorScreenParams } from '@react-navigation/native';
import { Post } from './post';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Create: { imageUri?: string; imageBase64?: string } | undefined;
  Notifications: undefined;
  Activity?: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Home: undefined; // alias for MainTabs -> Home
  CreatePost: {
    imageUri?: string;
    imageBase64?: string;
    width?: number;
    height?: number;
  } | undefined;
  PostDetail: {
    postId: string;
    initialPost?: Partial<Post>;
  };
  PublicCreatorProfile: {
    creatorId: string;
    username: string;
    avatarUrl?: string | null;
    bio?: string | null;
    followersCount?: number;
  };
  Settings: undefined;
  Notifications: undefined;
  Activity?: undefined;
};
