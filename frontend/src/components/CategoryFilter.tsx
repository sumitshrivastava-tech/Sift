import React, { memo, useCallback, useState, useMemo } from 'react';
import {
  ScrollView,
  Text,
  Pressable,
  StyleSheet,
  View,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES, Category } from '../data/categories';
import { safeHaptics, Haptics } from '../utils/haptics';

interface CategoryFilterProps {
  selectedCategory: Category;
  onSelectCategory: (category: Category) => void;
}

const MAX_VISIBLE_CATEGORIES = 5;

export const CategoryFilter = memo(
  ({ selectedCategory, onSelectCategory }: CategoryFilterProps) => {
    const [isModalVisible, setIsModalVisible] = useState(false);

    const handleSelect = useCallback(
      (cat: Category) => {
        safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectCategory(cat);
      },
      [onSelectCategory]
    );

    const handleOpenModal = useCallback(() => {
      safeHaptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsModalVisible(true);
    }, []);

    const handleCloseModal = useCallback(() => {
      setIsModalVisible(false);
    }, []);

    // Show top 5 categories. If the selected category is not in top 5, include it dynamically.
    const visibleCategories = useMemo(() => {
      const top5 = CATEGORIES.slice(0, MAX_VISIBLE_CATEGORIES);
      if (top5.includes(selectedCategory)) {
        return top5;
      }
      return [...top5.slice(0, MAX_VISIBLE_CATEGORIES - 1), selectedCategory];
    }, [selectedCategory]);

    return (
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visibleCategories.map((cat) => {
            const isSelected = cat === selectedCategory;
            return (
              <Pressable
                key={cat}
                onPress={() => handleSelect(cat)}
                className={isSelected ? 'bg-black' : 'bg-neutral-100'}
                style={({ pressed }) => [
                  styles.chip,
                  isSelected ? styles.chipSelected : styles.chipUnselected,
                  pressed && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  className={isSelected ? 'text-white font-bold' : 'text-neutral-900 font-semibold'}
                  style={[
                    styles.chipText,
                    isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}

          {/* Sleek '+' Button to open category sheet */}
          <Pressable
            onPress={handleOpenModal}
            style={({ pressed }) => [
              styles.plusButton,
              pressed && styles.plusButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="More categories"
          >
            <Ionicons name="add" size={17} color="#111827" />
          </Pressable>
        </ScrollView>

        {/* Categories Bottom Sheet / Modal */}
        <Modal
          visible={isModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseModal}
        >
          <TouchableWithoutFeedback onPress={handleCloseModal}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={styles.modalTitle}>Explore Categories</Text>
                      <Text style={styles.modalSubtitle}>Filter your feed by aesthetic</Text>
                    </View>
                    <Pressable
                      onPress={handleCloseModal}
                      hitSlop={10}
                      style={styles.modalCloseBtn}
                    >
                      <Ionicons name="close" size={20} color="#111827" />
                    </Pressable>
                  </View>

                  {/* Category Grid in Modal */}
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map((cat) => {
                      const isSelected = cat === selectedCategory;
                      return (
                        <Pressable
                          key={`modal-${cat}`}
                          onPress={() => {
                            handleSelect(cat);
                            handleCloseModal();
                          }}
                          className={isSelected ? 'bg-black' : 'bg-neutral-100'}
                          style={[
                            styles.modalChip,
                            isSelected ? styles.modalChipSelected : styles.modalChipUnselected,
                          ]}
                        >
                          <Text
                            className={isSelected ? 'text-white font-bold' : 'text-neutral-900 font-semibold'}
                            style={[
                              styles.modalChipText,
                              isSelected ? styles.modalChipTextSelected : styles.modalChipTextUnselected,
                            ]}
                          >
                            {cat}
                          </Text>
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={15}
                              color="#FFFFFF"
                              style={{ marginLeft: 6 }}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    );
  }
);

CategoryFilter.displayName = 'CategoryFilter';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipUnselected: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  chipPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  chipTextUnselected: {
    color: '#111827',
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  plusButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButtonPressed: {
    backgroundColor: '#E5E7EB',
    transform: [{ scale: 0.94 }],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  modalChipUnselected: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalChipSelected: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
  },
  modalChipText: {
    fontSize: 14,
  },
  modalChipTextUnselected: {
    color: '#111827',
    fontWeight: '700',
  },
  modalChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
