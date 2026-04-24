import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Stars } from '../src/components/ui';
import { useI18n } from '../src/i18n';

const MEDALS = ['🥇','🥈','🥉'];
const PODIUM_COLORS = ['#C8A84B','#C0C0C0','#CD7F32'];

const ALL_DATA: Record<string, any[]> = {
  week: [
    { id:1, name:'Dr. Ahmed Hassan',   initials:'AH', cat:'Criminal Defense', rating:4.9, wins:287, score:1120, city:'Cairo',       verified:true  },
    { id:5, name:'Dr. Omar Shafik',    initials:'OS', cat:'IP Law',           rating:4.9, wins:231, score:1089, city:'Cairo',       verified:true  },
    { id:3, name:'Khaled Mansour',     initials:'KM', cat:'Corporate',        rating:4.7, wins:118, score:1052, city:'Cairo',       verified:true  },
    { id:2, name:'Dr. Nadia El-Masri', initials:'NE', cat:'Family Law',       rating:4.8, wins:165, score:1021, city:'Alexandria',  verified:true  },
    { id:4, name:'Sara Fouad',         initials:'SF', cat:'Real Estate',      rating:4.6, wins:71,  score:956,  city:'Giza',        verified:true  },
    { id:6, name:'Layla Ibrahim',      initials:'LI', cat:'Labour Law',       rating:4.5, wins:48,  score:847,  city:'Cairo',       verified:false },
  ],
  month: [
    { id:5, name:'Dr. Omar Shafik',    initials:'OS', cat:'IP Law',           rating:4.9, wins:231, score:2340, city:'Cairo',       verified:true  },
    { id:1, name:'Dr. Ahmed Hassan',   initials:'AH', cat:'Criminal Defense', rating:4.9, wins:287, score:2287, city:'Cairo',       verified:true  },
    { id:2, name:'Dr. Nadia El-Masri', initials:'NE', cat:'Family Law',       rating:4.8, wins:165, score:1890, city:'Alexandria',  verified:true  },
    { id:3, name:'Khaled Mansour',     initials:'KM', cat:'Corporate',        rating:4.7, wins:118, score:1765, city:'Cairo',       verified:true  },
    { id:4, name:'Sara Fouad',         initials:'SF', cat:'Real Estate',      rating:4.6, wins:71,  score:1432, city:'Giza',        verified:true  },
    { id:6, name:'Layla Ibrahim',      initials:'LI', cat:'Labour Law',       rating:4.5, wins:48,  score:1120, city:'Cairo',       verified:false },
  ],
  alltime: [
    { id:1, name:'Dr. Ahmed Hassan',   initials:'AH', cat:'Criminal Defense', rating:4.9, wins:287, score:9870, city:'Cairo',       verified:true  },
    { id:2, name:'Dr. Nadia El-Masri', initials:'NE', cat:'Family Law',       rating:4.8, wins:165, score:8430, city:'Alexandria',  verified:true  },
    { id:5, name:'Dr. Omar Shafik',    initials:'OS', cat:'IP Law',           rating:4.9, wins:231, score:7960, city:'Cairo',       verified:true  },
    { id:3, name:'Khaled Mansour',     initials:'KM', cat:'Corporate',        rating:4.7, wins:118, score:6540, city:'Cairo',       verified:true  },
    { id:4, name:'Sara Fouad',         initials:'SF', cat:'Real Estate',      rating:4.6, wins:71,  score:5210, city:'Giza',        verified:true  },
    { id:6, name:'Layla Ibrahim',      initials:'LI', cat:'Labour Law',       rating:4.5, wins:48,  score:3890, city:'Cairo',       verified:false },
  ],
};

export default function LeaderboardScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<'week'|'month'|'alltime'>('month');
  const data = ALL_DATA[period];
  const top3 = data.slice(0, 3);
  const rest  = data.slice(3);
  const serif = { fontFamily: 'Cairo-Bold' };

  // Podium order: 2nd (left), 1st (center, tallest), 3rd (right)
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const podiumHeights = [90, 120, 70];

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+10, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:14 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:20 }}>🏅 Lawyer Leaderboard</Text>
            <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>Ranked by win rate, rating & consultations</Text>
          </View>
        </View>
        {/* Period selector — matches reference */}
        <View style={{ flexDirection:'row', backgroundColor:C.card, borderRadius:12, padding:4, gap:4 }}>
          {([['week','This Week'],['month','This Month'],['alltime','All Time']] as [string,string][]).map(([v,l]) => (
            <TouchableOpacity key={v} onPress={() => setPeriod(v as any)}
              style={{ flex:1, paddingVertical:8, borderRadius:9, backgroundColor:period===v ? C.surface : 'transparent', alignItems:'center' }}>
              <Text style={{ color:period===v ? C.text : C.muted, fontWeight:period===v?'700':'400', fontSize:12 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom:100 }}>
        {/* ── Podium visualization — matches reference exactly ── */}
        <View style={{ paddingVertical:30, paddingHorizontal:20, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border }}>
          <View style={{ flexDirection:'row', alignItems:'flex-end', justifyContent:'center', gap:10 }}>
            {podiumOrder.map((lawyer, idx) => {
              if (!lawyer) return null;
              const realRank = idx === 0 ? 1 : idx === 1 ? 0 : 2; // index in podium vs data rank
              const rank  = [2, 1, 3][idx]; // 2nd, 1st, 3rd
              const color = PODIUM_COLORS[rank - 1];
              const h     = podiumHeights[idx];
              const size  = rank === 1 ? 58 : 48;

              return (
                <View key={lawyer.id} style={{ alignItems:'center', width:100 }}>
                  {/* Medal */}
                  <Text style={{ fontSize: rank===1 ? 24 : 20, marginBottom:6 }}>{MEDALS[rank-1]}</Text>

                  {/* Avatar with colored ring */}
                  <View style={{ width:size, height:size, borderRadius:size/2, borderWidth:3, borderColor:color, marginBottom:6, overflow:'hidden', alignItems:'center', justifyContent:'center', backgroundColor:C.gold }}>
                    <Text style={{ ...serif, color:'#000', fontWeight:'800', fontSize:rank===1?18:14 }}>{lawyer.initials}</Text>
                  </View>

                  {/* Name */}
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:11, textAlign:'center', marginBottom:3 }} numberOfLines={2}>
                    {lawyer.name}
                  </Text>

                  {/* Podium block */}
                  <View style={{
                    width:'100%', height:h, borderRadius:8,
                    backgroundColor:`${color}20`,
                    borderWidth:1.5, borderColor:`${color}55`,
                    alignItems:'center', justifyContent:'center',
                  }}>
                    <Text style={{ ...serif, color, fontWeight:'700', fontSize:15 }}>{lawyer.score.toLocaleString()}</Text>
                    <Text style={{ color:C.muted, fontSize:9, marginTop:2 }}>pts</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Ranked list (4th+) ── */}
        <View style={{ paddingHorizontal:16, paddingTop:14 }}>
          {rest.map((lawyer, i) => (
            <TouchableOpacity key={lawyer.id}
              onPress={() => router.push(`/lawyer/${lawyer.id}` as any)}
              style={{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
              <Text style={{ color:C.muted, fontWeight:'800', fontSize:16, width:24, textAlign:'center' }}>#{i+4}</Text>
              <View style={{ width:42, height:42, borderRadius:21, backgroundColor:C.gold, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Text style={{ ...serif, color:'#000', fontWeight:'800', fontSize:14 }}>{lawyer.initials}</Text>
              </View>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{lawyer.name}</Text>
                  {lawyer.verified && <Text style={{ color:C.green, fontSize:11 }}>✅</Text>}
                </View>
                <Text style={{ color:C.muted, fontSize:12, marginTop:1 }}>{lawyer.cat} · {lawyer.city}</Text>
                <Stars rating={lawyer.rating} C={C} size={11} />
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Text style={{ ...serif, color:C.gold, fontWeight:'700', fontSize:17 }}>{lawyer.score.toLocaleString()}</Text>
                <Text style={{ color:C.muted, fontSize:10 }}>pts</Text>
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname:'/book', params:{ lawyer:lawyer.id } } as any)}
                style={{ backgroundColor:C.gold, borderRadius:8, paddingHorizontal:12, paddingVertical:7, marginLeft:4 }}>
                <Text style={{ color:'#000', fontWeight:'700', fontSize:12 }}>Book</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
