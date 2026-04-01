import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  FlatList, Share, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradient } from '../src/components/Gradient';
import { useI18n } from '../src/i18n';

// ── Data matching reference LawNewsPage exactly ──────────────────────────────
const STORY_CATS = [
  { id:'all',         label:'All',        color:'#9A6F2A', emoji:'⚖️' },
  { id:'criminal',    label:'Criminal',   color:'#DC2626', emoji:'🔒' },
  { id:'family',      label:'Family',     color:'#7C3AED', emoji:'👨‍👩‍👧' },
  { id:'corporate',   label:'Corporate',  color:'#2563EB', emoji:'🏢' },
  { id:'property',    label:'Property',   color:'#059669', emoji:'🏠' },
  { id:'labour',      label:'Labour',     color:'#D97706', emoji:'⚒️' },
  { id:'ip',          label:'IP',         color:'#DB2777', emoji:'💡' },
  { id:'cyber',       label:'Cyber',      color:'#0891B2', emoji:'💻' },
  { id:'banking',     label:'Banking',    color:'#4F46E5', emoji:'🏦' },
  { id:'medical',     label:'Medical',    color:'#16A34A', emoji:'⚕️' },
];

const TAG_COLORS: Record<string, string> = {
  'BREAKING':'#DC2626','NEW LAW':'#2563EB','URGENT':'#D97706',
  'ANALYSIS':'#7C3AED','RULING':'#059669','REFORM':'#9A6F2A',
  'UPDATE':'#0891B2','ALERT':'#DB2777','OPINION':'#4F46E5',
};

const POST_GRADIENTS = [
  ['#1a0a00','#3d1f00'],['#0a0a1a','#1a1a3d'],['#0a1a0a','#1a3d1a'],
  ['#1a0a1a','#3d1a3d'],['#0a1a1a','#1a3d3d'],['#1a1a0a','#3d3d1a'],
  ['#1a0a0a','#3d0a0a'],['#0a0a0a','#2a2a2a'],
];

const NEWS = [
  { id:1, cat:'criminal', urgent:true,  tag:'BREAKING', date:'Mar 7, 2026', readTime:'3 min',
    title:"Egyptian Court: WhatsApp Screenshots Now Admissible as Primary Evidence",
    summary:"Cairo Court of Appeals rules encrypted messaging screenshots fully admissible in criminal proceedings — affecting 12,000+ pending cases.",
    body:"The Cairo Court of Appeals issued a landmark ruling that digital evidence — including WhatsApp messages, Signal chats, and encrypted app screenshots — is fully admissible in Egyptian criminal courts without requiring the original device. The ruling cites amendments to the Evidence Law No. 25 of 1968.",
    author:{name:'Legal Desk', avatar:'LD'}, tagColor:'#DC2626',
    stats:{views:4820, likes:312, comments:28}, gradient:0 },
  { id:2, cat:'family',   urgent:false, tag:'NEW LAW', date:'Mar 6, 2026', readTime:'5 min',
    title:"Personal Status Law Amendment: Divorce Without Court Now Possible in Egypt",
    summary:"Ministry of Justice approves streamlined divorce registration allowing mutual consent divorces to be processed at Notary Public offices.",
    body:"The Egyptian Ministry of Justice has approved a groundbreaking amendment to Personal Status Law No. 1 of 2000, enabling couples with mutual consent to complete divorce registration at licensed Notary Public offices without mandatory court hearings.",
    author:{name:'Family Law Beat', avatar:'FL'}, tagColor:'#2563EB',
    stats:{views:7200, likes:891, comments:143}, gradient:1 },
  { id:3, cat:'cyber',    urgent:true,  tag:'ALERT',   date:'Mar 6, 2026', readTime:'4 min',
    title:"Egypt PDPL Enforcement Begins: 47 Companies Fined in First Month",
    summary:"NTRA issued penalties totaling EGP 18.4M to companies violating the Personal Data Protection Law.",
    body:"Egypt's National Telecommunications Regulatory Authority issued its first wave of Personal Data Protection Law enforcement penalties. 47 companies across banking, e-commerce, and healthcare sectors received fines totaling EGP 18.4 million.",
    author:{name:'Tech Law Egypt', avatar:'TL'}, tagColor:'#DB2777',
    stats:{views:5340, likes:445, comments:67}, gradient:2 },
  { id:4, cat:'labour',   urgent:false, tag:'RULING',  date:'Mar 5, 2026', readTime:'4 min',
    title:"Supreme Court: Remote Work Employees Entitled to Full Transport Allowance",
    summary:"Landmark ruling closes loophole employers used to withhold transport benefits from remote workers — affects 340,000+ employees.",
    body:"Egypt's Supreme Constitutional Court ruled that remote work status does not strip employees of their right to transport allowances under Labour Law No. 12 of 2003. The ruling closes a widely-exploited loophole.",
    author:{name:'Labour Watch', avatar:'LW'}, tagColor:'#059669',
    stats:{views:8900, likes:1203, comments:89}, gradient:3 },
  { id:5, cat:'property',  urgent:false, tag:'REFORM',  date:'Mar 5, 2026', readTime:'3 min',
    title:"Real Estate Registry Digitization: All Cairo Deeds Online by June 2026",
    summary:"Ministry of Justice confirms full digital conversion of Cairo property registry — enabling instant title verification.",
    body:"Egypt's Ministry of Justice announced completion of Phase 2 of the Real Estate Registry Digitization Project. All Cairo property deeds issued after 1990 are now searchable online via the Shahr Aqari portal.",
    author:{name:'Property Desk', avatar:'PD'}, tagColor:'#059669',
    stats:{views:3200, likes:287, comments:34}, gradient:4 },
  { id:6, cat:'corporate', urgent:false, tag:'UPDATE',  date:'Mar 4, 2026', readTime:'6 min',
    title:"Egypt Companies Law Amendment: Single-Person LLC Now Recognized",
    summary:"Parliament approves amendment allowing Egyptian entrepreneurs to establish fully owned LLCs without requiring a second shareholder.",
    body:"The Egyptian Parliament approved an amendment to Companies Law No. 159 of 1981 recognising single-person limited liability companies, bringing Egypt in line with UAE and Saudi standards.",
    author:{name:'Corporate Law EG', avatar:'CL'}, tagColor:'#2563EB',
    stats:{views:6700, likes:923, comments:112}, gradient:5 },
  { id:7, cat:'criminal',  urgent:false, tag:'ANALYSIS',date:'Mar 4, 2026', readTime:'7 min',
    title:"New Anti-Cybercrime Amendments: 5-Year Sentences for Deep Fake Content",
    summary:"Egypt's amended Cybercrime Law introduces severe penalties for AI-generated fake images and videos used to defame or extort individuals.",
    body:"Egypt's Anti-Cybercrime Law amendments add Article 25-bis creating specific offences for deepfake content used for defamation, blackmail, or fraud. Penalties range from 5-10 years imprisonment.",
    author:{name:'Criminal Law Watch', avatar:'CW'}, tagColor:'#7C3AED',
    stats:{views:9100, likes:1450, comments:201}, gradient:6 },
  { id:8, cat:'banking',   urgent:false, tag:'REFORM',  date:'Mar 3, 2026', readTime:'5 min',
    title:"Central Bank of Egypt: Digital Lending Platforms Must Be Licensed by August 2026",
    summary:"CBE circular mandates all BNPL and digital lending apps to obtain banking licenses or cease consumer lending operations.",
    body:"The Central Bank of Egypt issued a binding circular requiring all digital lending and BNPL platforms operating in Egypt to obtain formal banking licenses under Banking Law No. 194 of 2020 by August 31, 2026.",
    author:{name:'Banking Law Egypt', avatar:'BL'}, tagColor:'#4F46E5',
    stats:{views:4100, likes:389, comments:45}, gradient:7 },
];

export default function NewsScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [activeCat, setActiveCat] = useState('all');
  const [liked,     setLiked]     = useState<number[]>([]);
  const [saved,     setSaved]     = useState<number[]>([]);
  const [expanded,  setExpanded]  = useState<number | null>(null);
  const [searchQ,   setSearchQ]   = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertSaved, setAlertSaved] = useState(false);

  const filtered = NEWS.filter(n => {
    const matchCat  = activeCat === 'all' || n.cat === activeCat;
    const matchSearch = !searchQ ||
      n.title.toLowerCase().includes(searchQ.toLowerCase()) ||
      n.summary.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  const toggleLike = (id: number) =>
    setLiked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleSave = (id: number) =>
    setSaved(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const serif = { fontFamily: 'CormorantGaramond-Bold' };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      {/* Top bar */}
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+10, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingBottom:10 }}>
          <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:18 }}>⚖️ Legal News</Text>
          {saved.length > 0 && (
            <TouchableOpacity onPress={() => setActiveCat('saved')}
              style={{ backgroundColor:`${C.gold}12`, borderWidth:1, borderColor:`${C.gold}33`, borderRadius:20, paddingHorizontal:12, paddingVertical:5 }}>
              <Text style={{ color:C.gold, fontSize:11, fontWeight:'700' }}>🔖 {saved.length} saved</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Instagram story circles matching reference exactly ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:14, paddingBottom:12, gap:12, flexDirection:'row' }}>
          {STORY_CATS.map(cat => {
            const active = activeCat === cat.id;
            return (
              <TouchableOpacity key={cat.id} onPress={() => setActiveCat(cat.id)}
                style={{ alignItems:'center', gap:5, flexShrink:0 }}>
                <View style={{
                  width:52, height:52, borderRadius:26,
                  backgroundColor: active ? cat.color : `${cat.color}15`,
                  borderWidth: 2.5,
                  borderColor: active ? cat.color : C.border,
                  alignItems:'center', justifyContent:'center',
                  shadowColor: active ? cat.color : 'transparent',
                  shadowOffset:{ width:0, height:4 },
                  shadowOpacity: active ? 0.4 : 0,
                  shadowRadius:8,
                  elevation: active ? 6 : 0,
                }}>
                  <Text style={{ fontSize:18 }}>{cat.emoji}</Text>
                </View>
                <Text style={{ fontSize:9, fontWeight:active?'700':'400', color:active?cat.color:C.muted, letterSpacing:0.2 }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Search bar */}
        <View style={{ paddingHorizontal:14, paddingBottom:10 }}>
          <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:20, paddingHorizontal:14, paddingVertical:9, gap:8 }}>
            <Text style={{ fontSize:14, color:C.muted }}>🔍</Text>
            <TextInput value={searchQ} onChangeText={setSearchQ}
              placeholder="Search legal news..." placeholderTextColor={C.muted}
              style={{ flex:1, color:C.text, fontSize:13 }} />
            {searchQ.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQ('')}>
                <Text style={{ color:C.muted, fontSize:16 }}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:100 }}>
        {/* Stories count */}
        <View style={{ paddingHorizontal:14, paddingVertical:8 }}>
          <Text style={{ color:C.muted, fontSize:11, fontWeight:'600' }}>{filtered.length} stories</Text>
        </View>

        {/* ── Post cards matching reference dark gradient style exactly ── */}
        {filtered.map((post, i) => {
          const isLiked    = liked.includes(post.id);
          const isSaved    = saved.includes(post.id);
          const isExpanded = expanded === post.id;
          const likeCount  = post.stats.likes + (isLiked ? 1 : 0);
          const tagColor   = TAG_COLORS[post.tag] || C.gold;
          const [g1, g2]   = POST_GRADIENTS[post.gradient];
          const catInfo    = STORY_CATS.find(c => c.id === post.cat);

          return (
            <View key={post.id} style={{ backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border }}>
              {/* Post header — author + date + tag */}
              <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, gap:10 }}>
                <View style={{
                  width:36, height:36, borderRadius:18,
                  backgroundColor: `${tagColor}88`,
                  borderWidth:2, borderColor:`${tagColor}44`,
                  alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Text style={{ fontSize:11, fontWeight:'800', color:'#fff' }}>{post.author.avatar}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ fontWeight:'700', fontSize:13, color:C.text }}>{post.author.name}</Text>
                  <Text style={{ fontSize:10, color:C.muted }}>{post.date} · {post.readTime} read</Text>
                </View>
                <View style={{ backgroundColor:tagColor, borderRadius:20, paddingHorizontal:8, paddingVertical:3 }}>
                  <Text style={{ color:'#fff', fontSize:9, fontWeight:'800', letterSpacing:0.7 }}>{post.tag}</Text>
                </View>
                {post.urgent && (
                  <View style={{ width:8, height:8, borderRadius:4, backgroundColor:'#DC2626' }} />
                )}
              </View>

              {/* ── Dark gradient card — real LinearGradient matching reference exactly ── */}
              <TouchableOpacity activeOpacity={0.9}
                onPress={() => setExpanded(isExpanded ? null : post.id)}>
                <Gradient colors={[g1, g2]} style={{ minHeight:200, justifyContent:'flex-end', padding:20, position:'relative' }}>

                {/* Category badge */}
                <View style={{ position:'absolute', top:16, left:16, backgroundColor:`${catInfo?.color || C.gold}30`, borderWidth:1, borderColor:`${catInfo?.color || C.gold}55`, borderRadius:20, paddingHorizontal:10, paddingVertical:4 }}>
                  <Text style={{ color: catInfo?.color || C.gold, fontSize:10, fontWeight:'700' }}>
                    {catInfo?.emoji} {catInfo?.label}
                  </Text>
                </View>

                {/* Title */}
                <Text style={{ color:'#fff', fontSize:15, fontWeight:'800', lineHeight:22, marginBottom:8, textShadowColor:'rgba(0,0,0,0.5)', textShadowOffset:{width:0,height:1}, textShadowRadius:4 }}>
                  {post.title}
                </Text>

                {/* Stats row */}
                <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>
                  👁 {post.stats.views.toLocaleString()} · ❤️ {likeCount}
                </Text>
                </Gradient>
              </TouchableOpacity>

              {/* Expanded body */}
              {isExpanded && (
                <View style={{ padding:16, backgroundColor:C.card, borderTopWidth:1, borderTopColor:C.border }}>
                  <Text style={{ color:C.muted, fontSize:13, lineHeight:22, marginBottom:12 }}>{post.body}</Text>
                  <TouchableOpacity onPress={() => router.push({ pathname:'/(tabs)/lawyers', params:{ cat: post.cat } } as any)}
                    style={{ backgroundColor:C.gold, borderRadius:10, padding:12, alignItems:'center' }}>
                    <Text style={{ color:'#000', fontWeight:'700', fontSize:13 }}>
                      Find a {catInfo?.label} Lawyer →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action row — like / comment / share / save */}
              <View style={{ flexDirection:'row', paddingHorizontal:14, paddingVertical:8, borderTopWidth:1, borderTopColor:`${C.border}60`, gap:4 }}>
                <TouchableOpacity onPress={() => toggleLike(post.id)}
                  style={{ flexDirection:'row', alignItems:'center', gap:5, paddingVertical:5, paddingRight:10 }}>
                  <Text style={{ fontSize:16 }}>{isLiked ? '❤️' : '🤍'}</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>{likeCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : post.id)}
                  style={{ flexDirection:'row', alignItems:'center', gap:5, paddingVertical:5, paddingRight:10 }}>
                  <Text style={{ fontSize:16 }}>💬</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>{post.stats.comments}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Share.share({ message: `${post.title}\n\nRead on Wakeel.eg`, title: post.title })}
                  style={{ flexDirection:'row', alignItems:'center', gap:5, paddingVertical:5, paddingRight:10 }}>
                  <Text style={{ fontSize:16 }}>↗️</Text>
                  <Text style={{ color:C.muted, fontSize:12 }}>Share</Text>
                </TouchableOpacity>
                <View style={{ flex:1 }} />
                <TouchableOpacity onPress={() => toggleSave(post.id)}
                  style={{ padding:5 }}>
                  <Text style={{ fontSize:16 }}>{isSaved ? '🔖' : '🔖'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={{ padding:60, alignItems:'center' }}>
            <Text style={{ fontSize:40, marginBottom:12 }}>📰</Text>
            <Text style={{ color:C.muted, fontSize:13 }}>No news matching your filter</Text>
          </View>
        )}

        {/* ── Email digest CTA matching reference ── */}
        <View style={{ margin:0, padding:20, backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border }}>
          <Text style={{ fontWeight:'700', fontSize:14, color:C.text, marginBottom:4 }}>📧 Daily Legal Digest</Text>
          <Text style={{ color:C.muted, fontSize:12, marginBottom:12, lineHeight:19 }}>
            Top legal news every morning at 8AM — Egyptian law updates, rulings & alerts.
          </Text>
          {alertSaved ? (
            <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
              <Text style={{ color:C.green, fontSize:13, fontWeight:'700' }}>✓ Subscribed! You'll hear from us tomorrow morning.</Text>
            </View>
          ) : (
            <View style={{ flexDirection:'row', gap:8 }}>
              <TextInput value={alertEmail} onChangeText={setAlertEmail}
                placeholder="your@email.com" placeholderTextColor={C.muted}
                keyboardType="email-address"
                style={{ flex:1, backgroundColor:C.card, borderWidth:1.5, borderColor:C.border, borderRadius:20, paddingHorizontal:14, paddingVertical:9, color:C.text, fontSize:12 }} />
              <TouchableOpacity onPress={() => { if (alertEmail) setAlertSaved(true); }}
                style={{ backgroundColor:C.gold, borderRadius:20, paddingHorizontal:16, paddingVertical:9 }}>
                <Text style={{ color:'#000', fontWeight:'700', fontSize:12 }}>Subscribe →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
