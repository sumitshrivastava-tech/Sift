import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { safeHaptics, Haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import {
  getUserBoardsApi,
  createBoardApi,
  savePostToBoardApi,
  BoardData,
  parseJsonArray,
} from '../api';
import { Post } from '../types/post';

interface SaveModalProps {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onSavedToBoard?: (board: BoardData) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Default initial starter boards if user has no boards created yet
const MOCK_STARTER_BOARDS: BoardData[] = [
  {
    id: 'board-brutalism-1',
    name: 'Brutalist Architecture',
    description: 'Concrete, geometric angles, and monumental spaces.',
    isPrivate: true,
    ownerId: 'cmvwiqmw20000macy9j8k6gwr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: {
      id: 'cmvwiqmw20000macy9j8k6gwr',
      username: 'studioarchi',
      fullName: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    },
    collaborators: [
      {
        id: 'collab-1',
        role: 'owner',
        user: {
          id: 'cmvwiqmw20000macy9j8k6gwr',
          username: 'studioarchi',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        },
      },
      {
        id: 'collab-2',
        role: 'editor',
        user: {
          id: 'user-2',
          username: 'kuro_space',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        },
      },
      {
        id: 'collab-3',
        role: 'editor',
        user: {
          id: 'user-3',
          username: 'elena_scandi',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
        },
      },
    ],
    _count: {
      saves: 14,
      collaborators: 3,
    },
  },
  {
    id: 'board-scandi-2',
    name: 'Warm Minimalist Interiors',
    description: 'Oatmeal linen, light woods, and raking morning sunlight.',
    isPrivate: false,
    ownerId: 'cmvwiqmw20000macy9j8k6gwr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: {
      id: 'cmvwiqmw20000macy9j8k6gwr',
      username: 'studioarchi',
      fullName: 'Elena Rostova',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    },
    collaborators: [
      {
        id: 'collab-4',
        role: 'owner',
        user: {
          id: 'cmvwiqmw20000macy9j8k6gwr',
          username: 'studioarchi',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        },
      },
      {
        id: 'collab-5',
        role: 'editor',
        user: {
          id: 'user-4',
          username: 'rossidesign',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
        },
      },
    ],
    _count: {
      saves: 8,
      collaborators: 2,
    },
  },
];

export const SaveModal: React.FC<SaveModalProps> = ({
  visible,
  post,
  onClose,
  onSavedToBoard,
}) => {
  const insets = useSafeAreaInsets();
  const { currentUser, refreshSaves } = useAuth();

  const [boards, setBoards] = useState<BoardData[]>(MOCK_STARTER_BOARDS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New Board Inline Creation State
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardIsPrivate, setNewBoardIsPrivate] = useState(true);
  const [isSubmittingNewBoard, setIsSubmittingNewBoard] = useState(false);

  // Animation drivers for bottom-sheet slide up & backdrop opacity
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Fetch real boards whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      loadBoards();
      // Slide up
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          mass: 0.9,
          stiffness: 220,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide down
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setIsCreatingBoard(false);
      setNewBoardName('');
      setSelectedBoardId(null);
    }
  }, [visible]);

  const loadBoards = async () => {
    try {
      setIsLoading(true);
      const res = await getUserBoardsApi(currentUser.id);
      if (res.success && res.data && res.data.length > 0) {
        setBoards(res.data);
      } else {
        setBoards(MOCK_STARTER_BOARDS);
      }
    } catch {
      // Fallback to starter boards
      setBoards(MOCK_STARTER_BOARDS);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = useCallback(() => {
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [onClose, slideAnim, backdropAnim]);

  // Handle saving post to a chosen board
  const handleSelectBoard = async (board: BoardData) => {
    if (!post) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedBoardId(board.id);
    setIsSaving(true);

    try {
      await savePostToBoardApi(currentUser.id, post.id, board.id);
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSaves();
      onSavedToBoard?.(board);
      setTimeout(() => {
        handleDismiss();
      }, 350);
    } catch (error) {
      console.warn('Error saving post to board:', error);
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick save to general collection without specific board
  const handleSaveToQuickSaves = async () => {
    if (!post) return;
    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBoardId('general');
    setIsSaving(true);

    try {
      await savePostToBoardApi(currentUser.id, post.id, null);
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refreshSaves();
      setTimeout(() => {
        handleDismiss();
      }, 300);
    } catch (error) {
      console.warn('Error saving to quick saves:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle creating a new board and instantly saving current post to it
  const handleCreateAndSaveBoard = async () => {
    const trimmedName = newBoardName.trim();
    if (!trimmedName || !post) return;

    safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmittingNewBoard(true);

    try {
      const res = await createBoardApi({
        name: trimmedName,
        isPrivate: newBoardIsPrivate,
        ownerId: currentUser.id,
      });

      if (res.success && res.data) {
        const createdBoard = res.data;
        // Save post into this newly created board
        await savePostToBoardApi(currentUser.id, post.id, createdBoard.id);
        setBoards((prev) => [createdBoard, ...prev]);
        setSelectedBoardId(createdBoard.id);
        safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshSaves();
        onSavedToBoard?.(createdBoard);

        setTimeout(() => {
          handleDismiss();
        }, 350);
      }
    } catch (err) {
      console.warn('Failed to create board:', err);
      // Fallback optimistic board creation
      const optimisticBoard: BoardData = {
        id: `board-${Date.now()}`,
        name: trimmedName,
        isPrivate: newBoardIsPrivate,
        ownerId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: {
          id: currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar,
        },
        collaborators: [
          {
            id: `collab-${Date.now()}`,
            role: 'owner',
            user: {
              id: currentUser.id,
              username: currentUser.username,
              avatar: currentUser.avatar,
            },
          },
        ],
        _count: { saves: 1, collaborators: 1 },
      };
      setBoards((prev) => [optimisticBoard, ...prev]);
      setSelectedBoardId(optimisticBoard.id);
      safeHaptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        handleDismiss();
      }, 350);
    } finally {
      setIsSubmittingNewBoard(false);
    }
  };

  // Helper to extract cover thumbnail image from board saves or fallback
  const getBoardThumbnail = (item: BoardData) => {
    if (item.saves && item.saves.length > 0 && item.saves[0].post?.images) {
      const imgs = parseJsonArray(item.saves[0].post.images);
      if (imgs.length > 0) return imgs[0];
    }
    return null;
  };

  if (!visible && !post) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* Dimmed backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.55],
              }),
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Bottom Sheet Modal Container */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(insets.bottom, 20),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Pull Indicator Pill */}
          <View style={styles.dragPillWrapper}>
            <View style={styles.dragPill} />
          </View>

          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.sheetTitle}>Save to Canvas Board</Text>
              <Text style={styles.sheetSubtitle}>
                Add to your personal or multiplayer spaces
              </Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Current Post Preview Badge */}
          {post && (
            <View style={styles.postPreviewCard}>
              <Image
                source={post.imageUrl}
                style={styles.postThumbnail}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.postPreviewMeta}>
                <Text numberOfLines={1} style={styles.postPreviewTitle}>
                  {post.title}
                </Text>
                <Text style={styles.postPreviewAuthor}>
                  by @{post.creator.username}
                </Text>
              </View>
              <View style={styles.saveActivePill}>
                <Ionicons name="bookmark" size={12} color="#111827" />
                <Text style={styles.saveActiveText}>Saving</Text>
              </View>
            </View>
          )}

          {/* Quick Create Board Section */}
          {isCreatingBoard ? (
            <View style={styles.createBoardBox}>
              <View style={styles.createBoardInputRow}>
                <Ionicons name="folder-outline" size={18} color="#6B7280" />
                <TextInput
                  value={newBoardName}
                  onChangeText={setNewBoardName}
                  placeholder="Board name (e.g., Brutalist Inspiration)"
                  placeholderTextColor="#9CA3AF"
                  style={styles.boardInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndSaveBoard}
                />
              </View>

              <View style={styles.createBoardActionsRow}>
                {/* Private / Shared Toggle */}
                <Pressable
                  onPress={() => {
                    safeHaptics.selectionAsync();
                    setNewBoardIsPrivate(!newBoardIsPrivate);
                  }}
                  style={styles.privacyToggle}
                >
                  <Ionicons
                    name={newBoardIsPrivate ? 'lock-closed' : 'globe-outline'}
                    size={15}
                    color={newBoardIsPrivate ? '#111827' : '#2563EB'}
                  />
                  <Text style={styles.privacyToggleText}>
                    {newBoardIsPrivate ? 'Private Board' : 'Public / Shared'}
                  </Text>
                </Pressable>

                <View style={styles.createButtonCluster}>
                  <Pressable
                    onPress={() => {
                      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsCreatingBoard(false);
                      setNewBoardName('');
                    }}
                    style={styles.cancelCreateButton}
                  >
                    <Text style={styles.cancelCreateText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleCreateAndSaveBoard}
                    disabled={!newBoardName.trim() || isSubmittingNewBoard}
                    style={({ pressed }) => [
                      styles.confirmCreateButton,
                      !newBoardName.trim() && styles.disabledButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    {isSubmittingNewBoard ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="add" size={16} color="#FFFFFF" />
                        <Text style={styles.confirmCreateText}>Create & Save</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsCreatingBoard(true);
              }}
              style={({ pressed }) => [
                styles.createNewTrigger,
                pressed && styles.buttonPressed,
              ]}
            >
              <View style={styles.createNewIconCircle}>
                <Ionicons name="add" size={20} color="#111827" />
              </View>
              <Text style={styles.createNewText}>Create New Canvas Board</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
          )}

          {/* Boards List */}
          <Text style={styles.sectionHeading}>YOUR BOARDS</Text>

          {isLoading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator size="small" color="#111827" />
            </View>
          ) : (
            <FlatList
              data={boards}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.boardsListContent}
              style={{ maxHeight: SCREEN_HEIGHT * 0.38 }}
              ListHeaderComponent={
                // Default Quick Saves Row
                <Pressable
                  onPress={handleSaveToQuickSaves}
                  style={({ pressed }) => [
                    styles.boardRow,
                    selectedBoardId === 'general' && styles.boardRowSelected,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <View style={[styles.boardThumbPlaceholder, { backgroundColor: '#F3F4F6' }]}>
                    <Ionicons name="bookmark" size={18} color="#111827" />
                  </View>
                  <View style={styles.boardInfo}>
                    <Text style={styles.boardName}>Quick Saves</Text>
                    <Text style={styles.boardMetaText}>Default saved collection</Text>
                  </View>
                  {selectedBoardId === 'general' && (
                    <View style={styles.checkIconCircle}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              }
              renderItem={({ item }) => {
                const isSelected = selectedBoardId === item.id;
                const thumbnail = getBoardThumbnail(item);
                const hasCollaborators =
                  item.collaborators && item.collaborators.length > 1;

                return (
                  <Pressable
                    onPress={() => handleSelectBoard(item)}
                    style={({ pressed }) => [
                      styles.boardRow,
                      isSelected && styles.boardRowSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    {/* Thumbnail preview */}
                    {thumbnail ? (
                      <Image
                        source={thumbnail}
                        style={styles.boardThumbImage}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View style={styles.boardThumbPlaceholder}>
                        <Ionicons
                          name={hasCollaborators ? 'people' : 'folder'}
                          size={18}
                          color="#4B5563"
                        />
                      </View>
                    )}

                    {/* Board Meta & Collaborators */}
                    <View style={styles.boardInfo}>
                      <View style={styles.boardTitleRow}>
                        <Text numberOfLines={1} style={styles.boardName}>
                          {item.name}
                        </Text>
                        {item.isPrivate ? (
                          <Ionicons
                            name="lock-closed"
                            size={12}
                            color="#9CA3AF"
                            style={{ marginLeft: 5 }}
                          />
                        ) : (
                          <Ionicons
                            name="globe-outline"
                            size={12}
                            color="#60A5FA"
                            style={{ marginLeft: 5 }}
                          />
                        )}
                      </View>

                      <View style={styles.boardMetaDetailsRow}>
                        <Text style={styles.boardMetaText}>
                          {item._count?.saves ?? 0} items
                        </Text>

                        {/* Overlapping Avatar Cluster for Multiplayer Collaborators */}
                        {hasCollaborators && (
                          <View style={styles.collabClusterWrapper}>
                            <View style={styles.avatarFacepile}>
                              {item.collaborators.slice(0, 3).map((c: any, idx: number) => (
                                <Image
                                  key={c.id || idx}
                                  source={
                                    c.user?.avatar ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                      c.user?.username || 'U'
                                    )}&background=random`
                                  }
                                  style={[
                                    styles.facepileAvatar,
                                    idx > 0 && styles.facepileOffset,
                                  ]}
                                />
                              ))}
                            </View>
                            <View style={styles.multiplayerBadge}>
                              <Ionicons name="sparkles" size={10} color="#4338CA" />
                              <Text style={styles.multiplayerBadgeText}>Collab</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Checkmark or Save action indicator */}
                    {isSelected ? (
                      <View style={styles.checkIconCircle}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.selectArrow}>
                        <Ionicons name="add-circle-outline" size={20} color="#9CA3AF" />
                      </View>
                    )}
                  </Pressable>
                );
              }}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  dragPillWrapper: {
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 8,
  },
  dragPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
  postPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  postThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  postPreviewMeta: {
    flex: 1,
    marginLeft: 10,
  },
  postPreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  postPreviewAuthor: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  saveActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  saveActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  createNewTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  createNewIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  createNewText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  createBoardBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  createBoardInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  boardInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  createBoardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  privacyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    gap: 5,
  },
  privacyToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  createButtonCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelCreateButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  cancelCreateText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  confirmCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
  },
  confirmCreateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  loadingWrapper: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  boardsListContent: {
    paddingBottom: 10,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  boardRowSelected: {
    backgroundColor: '#F3F4F6',
  },
  boardThumbImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  boardThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  boardMetaDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  boardMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  collabClusterWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarFacepile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  facepileAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB',
  },
  facepileOffset: {
    marginLeft: -6,
  },
  multiplayerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  multiplayerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4338CA',
  },
  checkIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectArrow: {
    padding: 4,
  },
});
