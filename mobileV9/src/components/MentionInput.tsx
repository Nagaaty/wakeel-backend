/**
 * MentionInput — Instagram/LinkedIn-style @mention autocomplete
 * Usage: drop-in replacement for TextInput where you want @mentions
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { forumAPI } from '../services/api';

export interface MentionUser {
  id: string;
  name: string;
  role: string;
  flair?: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  style?: any;
  inputStyle?: any;
  multiline?: boolean;
  maxHeight?: number;
  gold?: string;
  /** Called with the final text (mentions formatted as @[Name](id)) */
  onMentionChange?: (raw: string, display: string) => void;
}

export default function MentionInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  style,
  inputStyle,
  multiline = true,
  maxHeight = 120,
  gold = '#C8A84B',
}: Props) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const debounceRef = useRef<any>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    setLoadingSuggestions(true);
    try {
      const res: any = await forumAPI.getMentionableUsers(query);
      setSuggestions(res?.users || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleChange = useCallback((text: string) => {
    onChangeText(text);

    // Detect @-trigger: find the last @ before cursor
    const atIdx = text.lastIndexOf('@');
    if (atIdx === -1) {
      setSuggestions([]);
      setMentionQuery(null);
      return;
    }

    const afterAt = text.slice(atIdx + 1);
    // Only show if no space after @ (still typing the name)
    if (!afterAt.includes(' ') && afterAt.length <= 25) {
      setMentionQuery(afterAt);
      setMentionStart(atIdx);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(afterAt), 300);
    } else {
      setSuggestions([]);
      setMentionQuery(null);
    }
  }, [onChangeText, fetchSuggestions]);

  const selectMention = useCallback((user: MentionUser) => {
    // Replace the @query with @[Name]
    const before = value.slice(0, mentionStart);
    const mention = `@${user.name} `;
    const after = value.slice(mentionStart + 1 + (mentionQuery?.length || 0));
    onChangeText(before + mention + after);
    setSuggestions([]);
    setMentionQuery(null);
  }, [value, mentionStart, mentionQuery, onChangeText]);

  const GOLD = gold;

  return (
    <View style={[{ position: 'relative' }, style]}>
      {/* Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <View style={[styles.dropdown, { borderColor: GOLD + '40' }]}>
          {loadingSuggestions ? (
            <ActivityIndicator size="small" color={GOLD} style={{ margin: 10 }} />
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={u => u.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 180 }}
              renderItem={({ item: u }) => (
                <TouchableOpacity
                  onPress={() => selectMention(u)}
                  style={styles.suggestionRow}>
                  {/* Initials avatar */}
                  <View style={[styles.suggestionAvatar, { backgroundColor: GOLD + '20', borderColor: GOLD + '50' }]}>
                    <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>
                      {u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{u.name}</Text>
                    {u.flair && (
                      <Text style={[styles.suggestionFlair, { color: GOLD }]}>{u.flair}</Text>
                    )}
                  </View>
                  <Text style={styles.suggestionAt}>@</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Actual Text Input */}
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline={multiline}
        style={[{ maxHeight }, inputStyle]}
        textAlign="right"
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
    zIndex: 999,
  },
  suggestionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  suggestionFlair: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  suggestionAt: {
    fontSize: 16,
    color: '#888',
    fontWeight: '700',
  },
});
