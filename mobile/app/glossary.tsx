import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, SectionList, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const TERMS = [
  { ar:'استئناف',      en:'Appeal',            cat:'Criminal', def:'Formal request to a higher court to review and change the decision of a lower court. Must be filed within 30 days of verdict in Egypt.' },
  { ar:'إخلاء سبيل',  en:'Release on Bail',   cat:'Criminal', def:'Temporary release of an accused person from custody, usually upon payment of a security deposit determined by the court.' },
  { ar:'توكيل رسمي',   en:'Power of Attorney', cat:'Civil',    def:'Legal document authorizing one person (the attorney-in-fact) to act on behalf of another in legal, financial, or business matters.' },
  { ar:'تقادم',        en:'Prescription',      cat:'Civil',    def:"The extinguishing of a legal right or claim due to the passage of time without enforcement. Under Egyptian Civil Law, most claims prescribe after 15 years." },
  { ar:'حضانة',        en:'Child Custody',     cat:'Family',   def:'Legal right and responsibility to care for a minor child. Under Egyptian law, mothers typically have physical custody until age 10 (boys) or 12 (girls), extendable by the court.' },
  { ar:'خلع',          en:'Khul\'',            cat:'Family',   def:"Wife-initiated divorce in return for financial compensation (usually returning the mahr/dowry). Introduced in Egypt by Law No. 1 of 2000. No court fault required." },
  { ar:'دعوى',         en:'Lawsuit',           cat:'Civil',    def:'A legal action brought by one party against another in a court of law seeking a remedy or judgment.' },
  { ar:'دية',          en:'Blood Money',       cat:'Criminal', def:"Compensation paid to the victim's family in cases of unintentional homicide or serious injury, as an alternative to criminal punishment under Egyptian Sharia provisions." },
  { ar:'سجل تجاري',   en:'Commercial Register',cat:'Corporate',def:"Official government registry of businesses administered by Egypt's GAFI. All commercial entities must register before commencing business operations." },
  { ar:'شهر عقاري',   en:'Real Estate Registry',cat:'Property',def:'Egyptian government system for recording and publicizing property ownership, mortgages, and encumbrances. Registration is required for full legal protection of property rights.' },
  { ar:'عقد',          en:'Contract',          cat:'Civil',    def:'A legally binding agreement between two or more parties that creates mutual obligations enforceable by law. Requires offer, acceptance, and consideration under Egyptian Civil Code.' },
  { ar:'مكافأة نهاية الخدمة', en:'End of Service Gratuity', cat:'Labour', def:"Lump sum payment owed to an employee upon termination of employment. Under Labour Law No. 12 of 2003, equals one month's wage per year of service." },
  { ar:'نقابة المحامين', en:"Bar Association",  cat:'General',  def:"Egypt's official professional regulatory body for lawyers, established by Law No. 61 of 1968. All practicing lawyers must be registered members." },
  { ar:'نيابة عامة',   en:'Public Prosecution',cat:'Criminal', def:'State body responsible for criminal investigations and prosecutions in Egypt. Represents society in criminal proceedings and oversees law enforcement.' },
];

// Group by first Arabic letter
const groupByLetter = (terms: typeof TERMS) => {
  const groups: Record<string, typeof TERMS> = {};
  terms.forEach(t => {
    const letter = t.ar[0];
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(t);
  });
  return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b, 'ar')).map(([letter, data]) => ({ title: letter, data }));
};

export default function GlossaryScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const scrollRef = useRef<SectionList>(null);
  const serif = { fontFamily: 'CormorantGaramond-Bold' };

  const filtered = search
    ? TERMS.filter(t => t.ar.includes(search) || t.en.toLowerCase().includes(search.toLowerCase()) || t.cat.toLowerCase().includes(search.toLowerCase()))
    : TERMS;

  const sections = search ? [{ title:'Results', data: filtered }] : groupByLetter(TERMS);
  const letters  = search ? [] : sections.map(s => s.title);

  return (
    <View style={{ flex:1, backgroundColor:C.bg, flexDirection:'row' }}>
      <View style={{ flex:1 }}>
        {/* Header */}
        <View style={{ backgroundColor:C.surface, paddingTop:insets.top+10, paddingHorizontal:16, paddingBottom:10, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:18 }}>📖 Legal Glossary</Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ padding:12, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border }}>
          <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:20, paddingHorizontal:14, paddingVertical:9, gap:8 }}>
            <Text>🔍</Text>
            <TextInput value={search} onChangeText={setSearch}
              placeholder="Search in Arabic or English..." placeholderTextColor={C.muted}
              style={{ flex:1, color:C.text, fontSize:13 }} />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color:C.muted, fontSize:16 }}>×</Text></TouchableOpacity> : null}
          </View>
        </View>

        {/* Term list */}
        <SectionList
          ref={scrollRef as any}
          sections={sections}
          keyExtractor={item => item.ar}
          contentContainerStyle={{ paddingBottom:100 }}
          renderSectionHeader={({ section: { title } }) => (
            <View style={{ backgroundColor:C.bg, paddingHorizontal:16, paddingVertical:6 }}>
              <Text style={{ ...serif, color:C.gold, fontWeight:'700', fontSize:20 }}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isOpen = expanded === item.ar;
            return (
              <TouchableOpacity onPress={() => setExpanded(isOpen ? null : item.ar)}
                style={{ backgroundColor:C.card, borderWidth:1, borderColor:isOpen ? C.gold : C.border, borderRadius:12, marginHorizontal:14, marginBottom:8, overflow:'hidden' }}>
                <View style={{ flexDirection:'row', alignItems:'center', padding:14, gap:12 }}>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:3 }}>
                      <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:16 }}>{item.ar}</Text>
                      <View style={{ backgroundColor:`${C.accent}15`, borderRadius:8, paddingHorizontal:7, paddingVertical:2 }}>
                        <Text style={{ color:C.accent, fontSize:10, fontWeight:'700' }}>{item.cat}</Text>
                      </View>
                    </View>
                    <Text style={{ color:C.gold, fontSize:12, fontStyle:'italic' }}>{item.en}</Text>
                  </View>
                  <Text style={{ color:isOpen ? C.gold : C.muted, fontSize:16 }}>{isOpen ? '▲' : '▾'}</Text>
                </View>
                {isOpen && (
                  <View style={{ paddingHorizontal:14, paddingBottom:14, borderTopWidth:1, borderTopColor:C.border }}>
                    <Text style={{ color:C.muted, fontSize:13, lineHeight:22, marginTop:10 }}>{item.def}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Alphabetical index bar ── */}
      {!search && letters.length > 0 && (
        <View style={{ width:24, justifyContent:'center', paddingVertical:8, paddingRight:4 }}>
          {letters.map((letter, i) => (
            <TouchableOpacity key={letter}
              onPress={() => (scrollRef.current as any)?.scrollToLocation?.({ sectionIndex:i, itemIndex:0, animated:true })}
              style={{ paddingVertical:3, alignItems:'center' }}>
              <Text style={{ color:C.gold, fontSize:10, fontWeight:'700' }}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
