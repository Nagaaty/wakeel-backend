import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

interface HashtagTextProps {
  text: string;
  style?: object;
  numberOfLines?: number;
  goldColor?: string;
}

/**
 * Renders post text with #hashtags highlighted in gold/blue and tappable.
 * Tapping a hashtag navigates to the hashtag filtered feed.
 */
export default function HashtagText({ text, style, numberOfLines, goldColor = '#C9A84C' }: HashtagTextProps) {
  const router = useRouter();

  if (!text) return null;

  // Split by hashtag or mention pattern (supports Arabic + Latin + underscore)
  const parts = text.split(/([#@][\w\u0600-\u06FF_]+)/g);

  if (parts.length === 1) {
    // No formatting — plain text
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (/^#[\w\u0600-\u06FF_]+$/.test(part)) {
          return (
            <Text
              key={i}
              style={[styles.hashtag, { color: goldColor }]}
              onPress={() =>
                (router as any).push({
                  pathname: '/hashtag/[tag]',
                  params: { tag: part.slice(1).toLowerCase() },
                })
              }
            >
              {part}
            </Text>
          );
        } else if (/^@[\w\u0600-\u06FF_]+$/.test(part)) {
          return (
            <Text key={i} style={[styles.hashtag, { color: goldColor }]}>
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  hashtag: {
    fontWeight: '700',
  },
});
