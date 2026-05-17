import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { bookingsAPI } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const C = useTheme();
  const { isRTL } = useI18n();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const viewRef = useRef<View>(null);

  useEffect(() => {
    bookingsAPI.get(id as string)
      .then((res: any) => setBooking(res?.booking || res))
      .catch((e: any) => setError(e?.message || 'Failed to load receipt'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownload = async () => {
    try {
      const feeVal = parseFloat(booking?.fee || booking?.amount || '0');
      const baseFee = (feeVal * 0.9).toFixed(2);
      const platformFee = (feeVal * 0.1).toFixed(2);
      const date = new Date(booking?.created_at || new Date()).toLocaleDateString();
      const txId = String(booking?.id).slice(0, 8).toUpperCase();

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1A1A1A; padding: 40px; background-color: #FFFFFF; }
              .header { text-align: center; margin-bottom: 40px; }
              .logo { width: 80px; height: 80px; border-radius: 20px; background-color: #FFF; border: 2px solid #C8A84B; font-size: 40px; font-weight: bold; color: #C8A84B; line-height: 80px; margin: 0 auto 20px auto; text-align: center; }
              .title { font-size: 28px; font-weight: bold; margin: 0; }
              .subtitle { font-size: 16px; color: #666; margin-top: 5px; }
              .divider { height: 1px; background-color: #E8E1D5; margin: 30px 0; }
              .dashed { border-top: 1px dashed #C8A84B; background-color: transparent; height: 0; }
              .row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 16px; }
              .label { color: #666; }
              .value { font-weight: bold; }
              .total-box { background-color: #FDFBF7; border: 1px solid #D4C9B0; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 40px; }
              .total-label { font-size: 20px; font-weight: bold; }
              .total-value { font-size: 28px; font-weight: 900; color: #9A6F2A; }
              .footer { text-align: center; margin-top: 50px; font-size: 16px; color: #16A34A; font-weight: bold; }
            </style>
          </head>
          <body dir="${isRTL ? 'rtl' : 'ltr'}">
            <div class="header">
              <div class="logo">W</div>
              <p class="title">${isRTL ? 'إيصال دفع' : 'Payment Receipt'}</p>
              <p class="subtitle">Wakeel Legal Platform</p>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span class="label">${isRTL ? 'رقم المعاملة' : 'Transaction ID'}</span>
              <span class="value">#${txId}</span>
            </div>
            <div class="row">
              <span class="label">${isRTL ? 'تاريخ الدفع' : 'Payment Date'}</span>
              <span class="value">${date}</span>
            </div>
            <div class="row">
              <span class="label">${isRTL ? 'المحامي' : 'Lawyer'}</span>
              <span class="value">${booking?.lawyer_name || ''}</span>
            </div>
            <div class="row">
              <span class="label">${isRTL ? 'نوع الخدمة' : 'Service Type'}</span>
              <span class="value">${booking?.service_type || 'Consultation'}</span>
            </div>
            
            <div class="divider dashed"></div>
            
            <div class="row">
              <span class="label">${isRTL ? 'تكلفة الاستشارة' : 'Consultation Fee'}</span>
              <span class="value">${baseFee} ${isRTL ? 'ج.م' : 'EGP'}</span>
            </div>
            <div class="row">
              <span class="label">${isRTL ? 'رسوم المنصة' : 'Platform Fee'}</span>
              <span class="value">${platformFee} ${isRTL ? 'ج.م' : 'EGP'}</span>
            </div>
            
            <div class="total-box">
              <span class="total-label">${isRTL ? 'الإجمالي' : 'Total Paid'}</span>
              <span class="total-value">${feeVal.toFixed(2)} ${isRTL ? 'ج.م' : 'EGP'}</span>
            </div>
            
            <div class="footer">
              ✓ ${isRTL ? 'عملية دفع ناجحة' : 'Payment Successful'}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: isRTL ? 'تحميل الإيصال' : 'Download Receipt'
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate the receipt document');
    }
  };

  const rowDir = isRTL ? 'row' : 'row-reverse';
  const alignStart = isRTL ? 'flex-start' : 'flex-end';
  const alignEnd = isRTL ? 'flex-end' : 'flex-start';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FDFBF7', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FDFBF7', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Feather name="alert-circle" size={48} color="#DC2626" style={{ marginBottom: 16 }} />
        <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: C.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{isRTL ? 'رجوع' : 'Go Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fee = parseFloat(booking.fee || booking.amount || '0');
  const baseFee = fee * 0.9;
  const platformFee = fee * 0.1; // Simulated breakdown

  return (
    <View style={{ flex: 1, backgroundColor: '#F0EBE0' }}>
      {/* App Bar */}
      <View style={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#F0EBE0',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Feather name={isRTL ? "chevron-right" : "chevron-left"} size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ color: '#1A1A1A', fontSize: 18, fontWeight: '800' }}>{isRTL ? 'الإيصال' : 'Receipt'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* The Receipt Ticket */}
        <View ref={viewRef} style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 24,
          shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 8,
          borderWidth: 1, borderColor: '#E8E1D5'
        }}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#FDFBF7', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.gold }}>
              <Text style={{ color: C.gold, fontSize: 32, fontWeight: '900' }}>W</Text>
            </View>
            <Text style={{ color: '#1A1A1A', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>
              {isRTL ? 'إيصال الدفع' : 'Payment Receipt'}
            </Text>
            <Text style={{ color: '#666', fontSize: 14, fontWeight: '600' }}>
              Wakeel Legal Platform
            </Text>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F0EBE0', marginVertical: 20 }} />

          {/* Booking Info */}
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>{isRTL ? 'رقم المعاملة' : 'Transaction ID'}</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '700' }}>#{String(booking.id).slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>{isRTL ? 'تاريخ الدفع' : 'Payment Date'}</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '700' }}>{new Date(booking.created_at || new Date()).toLocaleDateString()}</Text>
            </View>
            <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>{isRTL ? 'المحامي' : 'Lawyer'}</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '700' }}>{booking.lawyer_name}</Text>
            </View>
            <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>{isRTL ? 'نوع الخدمة' : 'Service Type'}</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '700' }}>{booking.service_type || 'Consultation'}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: '#F0EBE0', marginVertical: 20, borderStyle: 'dashed' }} />

          {/* Price Breakdown */}
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>{isRTL ? 'تكلفة الاستشارة' : 'Consultation Fee'}</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '600' }}>{baseFee.toFixed(2)} {isRTL ? 'ج.م' : 'EGP'}</Text>
            </View>
            <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
              <Text style={{ color: '#666', fontSize: 14 }}>{isRTL ? 'رسوم المنصة' : 'Platform Fee'}</Text>
              <Text style={{ color: '#1A1A1A', fontSize: 14, fontWeight: '600' }}>{platformFee.toFixed(2)} {isRTL ? 'ج.م' : 'EGP'}</Text>
            </View>
          </View>

          {/* Total */}
          <View style={{ marginTop: 24, backgroundColor: '#FDFBF7', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#D4C9B0', flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#1A1A1A', fontSize: 18, fontWeight: '800' }}>{isRTL ? 'الإجمالي' : 'Total Paid'}</Text>
            <Text style={{ color: C.gold, fontSize: 24, fontWeight: '900' }}>{fee.toFixed(2)} <Text style={{ fontSize: 14 }}>{isRTL ? 'ج.م' : 'EGP'}</Text></Text>
          </View>

          {/* Status badge at bottom of ticket */}
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="check-circle" size={16} color="#16A34A" />
              <Text style={{ color: '#16A34A', fontWeight: '800', fontSize: 14 }}>{isRTL ? 'عملية دفع ناجحة' : 'Payment Successful'}</Text>
            </View>
          </View>

        </View>

        {/* Download Button */}
        <TouchableOpacity
          onPress={handleDownload}
          style={{
            marginTop: 24,
            backgroundColor: '#1A1A1A',
            paddingVertical: 16,
            borderRadius: 14,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6
          }}
        >
          <Feather name="download" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
            {isRTL ? 'تحميل / مشاركة الإيصال' : 'Download / Share Receipt'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
