// ─── Wakeel — Rate Your Lawyer Screen ────────────────────────────────────────
// Route: /review?bookingId=X&lawyerId=Y&lawyerName=Z
//   Shown after a completed booking (triggered from bookings list or notification)
//
// Features:
//   • Animated 5-star tap selector
//   • Case outcome: Won / Lost / Settled / Ongoing
//   • 20+ char comment textarea with live counter
//   • Anonymous posting option
//   • Existing reviews list below (paginated)
//   • Full Arabic RTL + English via useI18n()
//   • Submits to /api/lawyers/:id/review
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Animated, KeyboardAvoidingView, Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/i18n';
import { hapticLight, hapticSuccess, hapticSelect } from '../src/utils/haptics';
import { Avatar, Stars, Btn, Spinner, ErrMsg } from '../src/components/ui';
import { lawyersAPI } from '../src/services/api';

// ─── Outcome options ──────────────────────────────────────────────────────────
const OUTCOMES = [
  { id: 'won',     emojiKey: 'review.won',     color: '#22C55E' },
  { id: 'lost',    emojiKey: 'review.lost',    color: '#EF4444' },
  { id: 'settled', emojiKey: 'review.settled', color: '#F59E0B' },
  { id: 'ongoing', emojiKey: 'review.ongoing', color: '#6B7280' },
] as const;

type OutcomeId = typeof OUTCOMES[number]['id'];

// ─── Star rating component ────────────────────────────────────────────────────
function StarSelector({ rating, onRate, C }: {
  rating:  number;
  onRate:  (n: number) => void;
  C:       any;
}) {
  const scales = Array.from({ length: 5 }, () => useRef(new Animated.Value(1)).current);

  const tap = (n: number) => {
    onRate(n);
    scales.forEach((s, i) => {
      Animated.sequence([
        Animated.timing(s, { toValue: i < n ? 1.3 : 0.9, duration: 120, useNativeDriver: true }),
        Animated.spring(s,  { toValue: 1, useNativeDriver: true, damping: 8 }),
      ]).start();
    });
  };

  return (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', paddingVertical: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => tap(n)} activeOpacity={0.7}>
          <Animated.Text style={{
            fontSize:         42,
            transform:        [{ scale: scales[n - 1] }],
            color:            n <= rating ? '#C8A84B' : '#374151',
            textShadowColor:  n <= rating ? '#C8A84B80' : 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: n <= rating ? 8 : 0,
          }}>
            ★
          </Animated.Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Star label helper ────────────────────────────────────────────────────────
const STAR_LABELS: Record<number, { ar: string; en: string }> = {
  1: { ar: 'سيئ جداً',     en: 'Very Poor'   },
  2: { ar: 'ضعيف',         en: 'Poor'         },
  3: { ar: 'مقبول',        en: 'Average'      },
  4: { ar: 'جيد',          en: 'Good'         },
  5: { ar: 'ممتاز',        en: 'Excellent'    },
};

// ─── Review list item ─────────────────────────────────────────────────────────
function ReviewItem({ review, C, isRTL }: {
  review: any; C: any; isRTL: boolean;
}) {
  const textDir = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' };
  return (
    <View style={{
      backgroundColor: C.card2, borderRadius: 14, padding: 16, marginBottom: 12,
      borderWidth: 1, borderColor: C.border,
    }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Avatar
          C={C}
          initials={(review.client_name || '??').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
          size={36}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, ...textDir }}>
            {review.anonymous ? (isRTL ? 'مجهول' : 'Anonymous') : review.client_name}
          </Text>
          <Stars rating={review.rating} C={C} size={11} />
        </View>
        {review.outcome && (
          <View style={{
            backgroundColor: `${OUTCOMES.find(o => o.id === review.outcome)?.color || C.muted}18`,
            borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
          }}>
            <Text style={{ fontSize: 11, color: OUTCOMES.find(o => o.id === review.outcome)?.color || C.muted }}>
              {review.outcome === 'won' ? '✅ Won' : review.outcome === 'lost' ? '❌ Lost' : review.outcome === 'settled' ? '🤝 Settled' : '⏳ Ongoing'}
            </Text>
          </View>
        )}
      </View>
      {review.comment && (
        <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, ...textDir }}>
          "{review.comment}"
        </Text>
      )}
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
        {new Date(review.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ReviewScreen() {
  const C       = useTheme();
  const { t, isRTL } = useI18n();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{
    bookingId?:  string;
    lawyerId?:   string;
    lawyerName?: string;
  }>();

  const lawyerId   = params.lawyerId   || '';
  const lawyerName = params.lawyerName || '';

  const serif   = { fontFamily: 'CormorantGaramond-Bold' };
  const textDir = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' };

  // Form state
  const [rating,     setRating]     = useState(0);
  const [comment,    setComment]    = useState('');
  const [outcome,    setOutcome]    = useState<OutcomeId | ''>('');
  const [anonymous,  setAnonymous]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');

  // Existing reviews
  const [reviews,   setReviews]   = useState<any[]>([]);
  const [revLoading,setRevLoading]= useState(true);
  const [avgRating, setAvgRating] = useState(0);

  // Success animation
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpac  = useRef(new Animated.Value(0)).current;

  // Load existing reviews
  useEffect(() => {
    if (!lawyerId) { setRevLoading(false); return; }
    lawyersAPI.get(lawyerId)
      .then((d: any) => {
        const r = d.reviews || [];
        setReviews(r);
        if (r.length) {
          setAvgRating(r.reduce((s: number, x: any) => s + x.rating, 0) / r.length);
        }
      })
      .catch(() => {})
      .finally(() => setRevLoading(false));
  }, [lawyerId]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (rating === 0) { setError(t('review.selectRating')); return; }
    if (comment.length > 0 && comment.length < 20) { setError(t('review.minChars')); return; }
    setError(''); setSubmitting(true);
    try {
      await lawyersAPI.review(Number(lawyerId), {
        bookingId: params.bookingId,
        rating,
        comment:   comment.trim() || undefined,
        outcome:   outcome || undefined,
        anonymous,
      });
      setSubmitted(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 150 }),
        Animated.timing(successOpac,  { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch (err: any) {
      if (err?.message?.includes('already')) {
        setError(t('review.already'));
      } else {
        setError(t('review.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submitted state ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Animated.View style={{ alignItems: 'center', opacity: successOpac, transform: [{ scale: successScale }] }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: `${C.gold}18`,
            borderWidth: 2, borderColor: C.gold,
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Text style={{ fontSize: 52 }}>⭐</Text>
          </View>
          <Text style={{ ...serif, color: C.text, fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
            {t('review.submitted')}
          </Text>
          <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            {isRTL
              ? 'تقييمك يساعد الآخرين في اختيار المحامي المناسب'
              : 'Your review helps others find the right lawyer'}
          </Text>
          {/* Star display */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 28 }}>
            {[1,2,3,4,5].map(n => (
              <Text key={n} style={{ fontSize: 28, color: n <= rating ? C.gold : C.dim }}>★</Text>
            ))}
          </View>
          <Btn C={C} full size="lg" onPress={() => router.replace('/bookings' as any)}>
            {isRTL ? 'العودة للحجوزات' : 'Back to Bookings'}
          </Btn>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      {/* ── Header ── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 12,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.text, fontSize: 24 }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '700', ...textDir }}>
              {t('review.title')}
            </Text>
            {lawyerName ? (
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 1, ...textDir }}>
                {lawyerName}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {error ? <ErrMsg C={C} msg={error} /> : null}

        {/* ── Review form ── */}
        <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
          <Text style={{ ...serif, color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 6, ...textDir }}>
            {t('review.yourRating')}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16, ...textDir }}>
            {t('review.subtitle')}
          </Text>

          {/* Stars */}
          <StarSelector rating={rating} onRate={setRating} C={C} />

          {/* Star label */}
          {rating > 0 && (
            <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
              {isRTL ? STAR_LABELS[rating].ar : STAR_LABELS[rating].en}
            </Text>
          )}

          {/* Case outcome */}
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10, marginTop: 4, ...textDir }}>
            {t('review.outcome')}
          </Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {OUTCOMES.map(oc => {
              const sel = outcome === oc.id;
              return (
                <TouchableOpacity
                  key={oc.id}
                  onPress={() => setOutcome(sel ? '' : oc.id)}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 6,
                    backgroundColor: sel ? `${oc.color}20` : C.card2,
                    borderWidth: 2, borderColor: sel ? oc.color : C.border,
                    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: sel ? oc.color : C.muted, fontWeight: sel ? '700' : '400', fontSize: 13 }}>
                    {t(oc.emojiKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Comment */}
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 8, ...textDir }}>
            {t('review.comment')} <Text style={{ color: C.muted, fontWeight: '400', fontSize: 12 }}>({t('app.optional')})</Text>
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('review.commentPlaceholder')}
            placeholderTextColor={C.muted}
            multiline
            numberOfLines={4}
            maxLength={500}
            style={{
              backgroundColor: C.card2, borderWidth: 1,
              borderColor: comment.length > 0 && comment.length < 20 ? C.red : C.border,
              borderRadius: 12, padding: 14, color: C.text,
              fontSize: 14, lineHeight: 22, minHeight: 110,
              textAlignVertical: 'top',
              textAlign: isRTL ? 'right' : 'left',
            }}
          />
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {comment.length > 0 && comment.length < 20 ? (
              <Text style={{ color: C.red, fontSize: 11 }}>{t('review.minChars')}</Text>
            ) : <View />}
            <Text style={{ color: C.muted, fontSize: 11 }}>{comment.length} / 500</Text>
          </View>

          {/* Anonymous toggle */}
          <TouchableOpacity
            onPress={() => setAnonymous(a => !a)}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center', gap: 10,
              backgroundColor: anonymous ? `${C.accent}12` : C.card2,
              borderWidth: 1, borderColor: anonymous ? C.accent : C.border,
              borderRadius: 12, padding: 12, marginTop: 14,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6,
              backgroundColor: anonymous ? C.accent : 'transparent',
              borderWidth: 2, borderColor: anonymous ? C.accent : C.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {anonymous && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: anonymous ? C.accent : C.text, fontWeight: '600', fontSize: 13, ...textDir }}>
                {t('review.anonymous')}
              </Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 1, ...textDir }}>
                {isRTL ? 'سيظهر اسمك كـ "مجهول"' : 'Your name will appear as "Anonymous"'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <Btn C={C} full size="lg" disabled={submitting || rating === 0} onPress={handleSubmit} style={{ marginBottom: 24 }}>
          {submitting ? t('app.loading') : t('review.submit')}
        </Btn>

        {/* ── Existing reviews ── */}
        {revLoading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Spinner C={C} />
          </View>
        ) : reviews.length > 0 ? (
          <>
            <View style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
            }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, ...textDir }}>
                {t('review.viewAll')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: C.gold, fontWeight: '900', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>
                  {avgRating.toFixed(1)}
                </Text>
                <Stars rating={avgRating} C={C} size={13} />
                <Text style={{ color: C.muted, fontSize: 12 }}>
                  ({t('review.count', { n: reviews.length })})
                </Text>
              </View>
            </View>
            {reviews.slice(0, 5).map(review => (
              <ReviewItem key={review.id} review={review} C={C} isRTL={isRTL} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
