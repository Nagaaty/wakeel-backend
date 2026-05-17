import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const TEMPLATES = [
  { id:1, cat:'Family Law',     icon:'👨‍👩‍👧', name:'Divorce Settlement Agreement',   desc:'Standard separation & asset division agreement for Egyptian family courts.',          pages:8,  lang:'Arabic/English', downloads:2341 },
  { id:2, cat:'Real Estate',    icon:'🏠', name:'Property Purchase Contract',      desc:'Certified property sale/purchase agreement compliant with Egyptian Civil Law.',       pages:12, lang:'Arabic',          downloads:4102 },
  { id:3, cat:'Corporate Law',  icon:'🏢', name:'LLC Incorporation Documents',     desc:'Full set of documents to register an LLC under Egyptian Companies Law No. 159.',     pages:24, lang:'Arabic/English', downloads:1879 },
  { id:4, cat:'Labour Law',     icon:'💼', name:'Employment Contract',             desc:'Standard employment agreement with Egyptian Labour Law clauses and protections.',     pages:6,  lang:'Arabic',          downloads:5621 },
  { id:5, cat:'IP Law',         icon:'💡', name:'Trademark License Agreement',     desc:'IP licensing agreement registered with ITDA (Egyptian Trademark Office).',           pages:10, lang:'Arabic/English', downloads:892  },
  { id:6, cat:'Real Estate',    icon:'🏠', name:'Rental Lease Agreement',          desc:'Residential/commercial lease agreement compliant with Egyptian Rent Law.',           pages:5,  lang:'Arabic',          downloads:7203 },
  { id:7, cat:'Corporate Law',  icon:'🏢', name:'NDA / Confidentiality Agreement', desc:'Non-disclosure agreement for business use, bilingual with Arabic notarization.',     pages:3,  lang:'Arabic/English', downloads:3148 },
  { id:8, cat:'Labour Law',     icon:'💼', name:'Freelance Service Agreement',     desc:'Independent contractor agreement for Egyptian freelancers and remote workers.',      pages:4,  lang:'Arabic/English', downloads:2067 },
];

const CATS = ['All','Family Law','Real Estate','Corporate Law','Labour Law','IP Law'];

export default function ContractsScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [catFilter, setCatFilter] = useState('All');
  const [downloads, setDownloads] = useState<Record<number,number>>({});
  const serif = { fontFamily: 'Cairo-Bold' };

  const filtered = catFilter === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.cat === catFilter);

  const handleDownload = (template: typeof TEMPLATES[0]) => {
    setDownloads(d => ({ ...d, [template.id]: (d[template.id] || 0) + 1 }));
    Alert.alert(
      '⬇️ Download Started',
      `${template.name}\n\nIn a production app, this would download the ${template.lang} PDF template to your device.`,
      [{ text:'Got it', style:'default' }]
    );
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+10, paddingHorizontal:16, paddingBottom:10, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:18 }}>📜 Contract Templates</Text>
            <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>8 Egyptian law templates · Free download</Text>
          </View>
        </View>

        {/* ── Category filter chips matching reference ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:8 }}>
          {CATS.map(cat => {
            const active = catFilter === cat;
            return (
              <TouchableOpacity key={cat} onPress={() => setCatFilter(cat)}
                style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:active?C.gold:C.border, backgroundColor:active?`${C.gold}15`:'transparent' }}>
                <Text style={{ color:active?C.gold:C.text, fontSize:12, fontWeight:active?'700':'400' }}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Disclaimer */}
      <View style={{ backgroundColor:`${C.warn}08`, borderBottomWidth:1, borderBottomColor:`${C.warn}25`, paddingHorizontal:16, paddingVertical:10, flexDirection:'row', gap:8, alignItems:'flex-start' }}>
        <Text style={{ fontSize:14 }}>⚠️</Text>
        <Text style={{ color:C.muted, fontSize:12, lineHeight:18, flex:1 }}>
          These templates are starting points only. Always review any contract with a certified lawyer before signing.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {filtered.map(template => {
          const dlCount = template.downloads + (downloads[template.id] || 0);
          return (
            <View key={template.id} style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:16, padding:18, marginBottom:14 }}>
              {/* Category tag */}
              <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
                <Text style={{ fontSize:28 }}>{template.icon}</Text>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:5 }}>
                    <View style={{ backgroundColor:`${C.accent}15`, borderRadius:8, paddingHorizontal:9, paddingVertical:3 }}>
                      <Text style={{ color:C.accent, fontSize:11, fontWeight:'700' }}>{template.cat}</Text>
                    </View>
                    <Text style={{ color:C.muted, fontSize:11 }}>📄 {template.pages} pages · {template.lang}</Text>
                  </View>
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:14, lineHeight:20 }}>{template.name}</Text>
                </View>
              </View>

              <Text style={{ color:C.muted, fontSize:12, lineHeight:19, marginBottom:14 }}>{template.desc}</Text>

              {/* Stats + Download button */}
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <Text style={{ color:C.muted, fontSize:12 }}>⬇️ {dlCount.toLocaleString()} downloads</Text>
                <TouchableOpacity onPress={() => handleDownload(template)}
                  style={{ backgroundColor:`${C.gold}15`, borderWidth:1, borderColor:`${C.gold}35`, borderRadius:10, paddingHorizontal:18, paddingVertical:9 }}>
                  <Text style={{ color:C.gold, fontWeight:'700', fontSize:13 }}>⬇️ Download Free</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
