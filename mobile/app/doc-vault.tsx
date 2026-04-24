// ─── Wakeel — Document Vault — Sprint 4: Upload Progress Bar ─────────────────
import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Alert,
  RefreshControl, Animated, Easing,
} from "react-native";
import { router } from "expo-router";
import { useTheme } from "../src/theme";
import { Btn, Card, Spinner, Empty } from "../src/components/ui";
import { vaultAPI } from "../src/services/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useI18n } from "../src/i18n";
import { useScreenshotPrevention } from "../src/hooks/useScreenshotPrevention";

const TYPE_ICONS: Record<string, string> = {
  pdf: "📕", doc: "📘", docx: "📘",
  jpg: "🖼️", jpeg: "🖼️", png: "🖼️", default: "📄",
};

// ── Upload progress item ───────────────────────────────────────────────────────
interface UploadItem {
  id:       string;
  name:     string;
  size:     string;
  progress: number;       // 0–100
  status:   "uploading" | "done" | "error";
  error?:   string;
}

function ProgressBar({ progress, color, C }: { progress: number; color: string; C: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [progress]);
  return (
    <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
      <Animated.View style={{
        height: "100%", borderRadius: 2,
        backgroundColor: color,
        width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
      }} />
    </View>
  );
}

function UploadCard({ item, C, isRTL }: { item: UploadItem; C: any; isRTL: boolean }) {
  const ext  = item.name.split(".").pop()?.toLowerCase() || "default";
  const icon = TYPE_ICONS[ext] || TYPE_ICONS.default;
  const color = item.status === "error" ? C.red : item.status === "done" ? C.green : C.gold;

  return (
    <View style={{
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center", gap: 12,
      backgroundColor: C.card, borderWidth: 1,
      borderColor: item.status === "error" ? C.red + "40" : item.status === "done" ? C.green + "30" : C.gold + "30",
      borderRadius: 14, padding: 14, marginBottom: 10,
    }}>
      <View style={{ width: 46, height: 46, borderRadius: 12,
                     backgroundColor: color + "18",
                     alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Text style={{ fontSize: 22 }}>
          {item.status === "done" ? "✅" : item.status === "error" ? "❌" : icon}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
          {item.size} · {
            item.status === "done"  ? (isRTL ? "تم الرفع ✓" : "Uploaded ✓") :
            item.status === "error" ? (item.error || (isRTL ? "فشل الرفع" : "Upload failed")) :
            `${item.progress}%`
          }
        </Text>
        {item.status === "uploading" && (
          <ProgressBar progress={item.progress} color={C.gold} C={C} />
        )}
        {item.status === "error" && (
          <ProgressBar progress={100} color={C.red} C={C} />
        )}
        {item.status === "done" && (
          <ProgressBar progress={100} color={C.green} C={C} />
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DocVaultScreen() {
  const C      = useTheme();
  const { t, isRTL } = useI18n();
  useScreenshotPrevention(); // Sensitive screen — block screenshots
  const insets = useSafeAreaInsets();
  const serif  = { fontFamily: "Cairo-Bold" };

  const [docs,     setDocs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [uploads,  setUploads]  = useState<UploadItem[]>([]);

  const load = () =>
    vaultAPI.list()
      .then((d: any) => setDocs(d.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // ── Pick + upload with progress simulation ──────────────────────────────────
  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*", copyToCacheDirectory: true, multiple: true,
      });
      if (result.canceled) return;

      for (const file of result.assets) {
        const id   = `upload_${Date.now()}_${Math.random()}`;
        const size = file.size
          ? file.size > 1024 * 1024
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
            : `${(file.size / 1024).toFixed(0)} KB`
          : "—";

        // Add to upload queue
        setUploads(prev => [...prev, { id, name: file.name, size, progress: 0, status: "uploading" }]);

        try {
          // Get file info for accurate size
          const info = await FileSystem.getInfoAsync(file.uri);

          // Simulate progress while uploading
          const progressInterval = setInterval(() => {
            setUploads(prev => prev.map(u =>
              u.id === id && u.progress < 85
                ? { ...u, progress: Math.min(85, u.progress + Math.random() * 18 + 5) }
                : u
            ));
          }, 200);

          const formData = new FormData();
          formData.append("file", {
            uri:  file.uri,
            name: file.name,
            type: file.mimeType || "application/octet-stream",
          } as any);
          formData.append("folder", "vault");

          await vaultAPI.upload(formData);

          clearInterval(progressInterval);

          // Jump to 100
          setUploads(prev => prev.map(u =>
            u.id === id ? { ...u, progress: 100, status: "done" } : u
          ));

          // Remove from queue after 3s
          setTimeout(() => {
            setUploads(prev => prev.filter(u => u.id !== id));
            load();
          }, 3000);

        } catch (err: any) {
          setUploads(prev => prev.map(u =>
            u.id === id
              ? { ...u, progress: 100, status: "error",
                  error: err?.message || (isRTL ? "فشل الرفع" : "Upload failed") }
              : u
          ));
          // Remove error card after 5s
          setTimeout(() => setUploads(prev => prev.filter(u => u.id !== id)), 5000);
        }
      }
    } catch (e: any) {
      if (!e.message?.includes("cancel")) {
        Alert.alert(isRTL ? "خطأ" : "Error", e?.message || (isRTL ? "تعذر الرفع" : "Upload failed"));
      }
    }
  };

  const deleteDoc = async (id: number) => {
    Alert.alert(
      isRTL ? "حذف" : "Delete",
      isRTL ? "هل تريد حذف هذا المستند؟" : "Delete this document?",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        { text: isRTL ? "حذف" : "Delete", style: "destructive", onPress: async () => {
          await vaultAPI.delete(id).catch(() => {});
          setDocs(p => p.filter(d => d.id !== id));
        }},
      ]
    );
  };

  const totalDocs = docs.length;
  const activeUploads = uploads.filter(u => u.status === "uploading").length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 12,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row",
                       alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: C.text, fontSize: 22 }}>{isRTL ? "›" : "‹"}</Text>
            </TouchableOpacity>
            <View>
              <Text style={{ ...serif, color: C.text, fontWeight: "700", fontSize: 20 }}>
                {t("ai.docVault")}
              </Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>
                {totalDocs} {isRTL ? "مستند" : "documents"}
                {activeUploads > 0 ? ` · ${activeUploads} ${isRTL ? "جاري الرفع" : "uploading"}` : ""}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={pickAndUpload}
            style={{ backgroundColor: C.gold, borderRadius: 10,
                     paddingHorizontal: 14, paddingVertical: 8,
                     flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: "#000", fontWeight: "700", fontSize: 13 }}>
              {isRTL ? "+ رفع" : "+ Upload"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security badge */}
        <View style={{
          backgroundColor: C.green + "12", borderWidth: 1, borderColor: C.green + "25",
          borderRadius: 10, padding: 10, marginTop: 12,
          flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8,
        }}>
          <Text style={{ fontSize: 16 }}>🔒</Text>
          <Text style={{ color: C.muted, fontSize: 12, flex: 1, textAlign: isRTL ? "right" : "left" }}>
            {isRTL
              ? "مستنداتك مشفرة ومحمية. لا يمكن لأحد الوصول إليها إلا أنت."
              : "Your documents are encrypted. Only you can access them."}
          </Text>
        </View>
      </View>

      <FlatList
        data={docs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListHeaderComponent={
          uploads.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: "700",
                             marginBottom: 8, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? "جاري الرفع" : "UPLOADING"}
              </Text>
              {uploads.map(item => (
                <UploadCard key={item.id} item={item} C={C} isRTL={isRTL} />
              ))}
              <View style={{ height: 1, backgroundColor: C.border, marginBottom: 14 }} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading
            ? <Empty C={C} icon="🔐"
                title={isRTL ? "لا توجد مستندات" : "No Documents"}
                subtitle={isRTL ? "ارفع مستنداتك القانونية وابقها آمنة" : "Upload your legal documents and keep them safe"}
                action={{ label: isRTL ? "+ رفع مستند" : "+ Upload Document", onPress: pickAndUpload }} />
            : <View style={{ padding: 40, alignItems: "center" }}><Spinner C={C} /></View>
        }
        renderItem={({ item: doc }) => {
          const ext  = doc.name?.split(".").pop()?.toLowerCase() || "default";
          const icon = TYPE_ICONS[ext] || TYPE_ICONS.default;
          return (
            <View style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center", gap: 12,
              backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
              borderRadius: 14, padding: 14, marginBottom: 10,
            }}>
              <View style={{ width: 46, height: 46, borderRadius: 12,
                             backgroundColor: C.gold + "18",
                             alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
                  {doc.name}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {doc.size} · {doc.file_type?.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteDoc(doc.id)} style={{ padding: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}
