import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUI } from '../Design/ui';
import { mutationTable, fishValue, selectModifier, sizeLabel, formatFishValue } from '../Helper/fischValue';
import { displayValueText } from '../Helper/valueSources';

export default function TradeItemDetails({ item, mutations, scale, onSave, onClose, editing = false }) {
  const { c } = useUI();
  const insets = useSafeAreaInsets();
  const [weight, setWeight] = useState(item.catch ? String(item.catch.weightKg) : '');
  const [quantity, setQuantity] = useState(String(item.quantity || 1));
  const [picked, setPicked] = useState([item.catch?.mutation, ...(item.catch?.attributes || [])].filter(Boolean));
  const [query, setQuery] = useState('');
  const table = useMemo(() => mutationTable(mutations), [mutations]);
  const isFish = item.collection === 'fish';
  const kg = Number(weight), qty = Number(quantity);
  const valid = Number.isInteger(qty) && qty >= 1 && qty <= 99 && (!isFish || (Number.isFinite(kg) && kg > 0));
  const sale = isFish ? fishValue(item, kg, picked, table) : null;
  const prepared = { ...item, quantity: qty, ...(isFish ? {
    catch: { weightKg: kg, mutation: picked.find(n => table[n]?.kind === 'mutation') || null,
      attributes: picked.filter(n => table[n]?.kind === 'attribute') },
    npcEstimate: sale?.error ? null : { value: sale.value, range: sale.range, unit: 'C$' },
  } : {}) };
  const text = { color: c.text, fontSize: 16, marginBottom: 12 };
  const input = { color: c.text, backgroundColor: c.inputBg, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16 };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
          <Text style={[text, { fontSize: 24, fontWeight: '700' }]}>{item.name}</Text>
          {isFish && <>
            <Text style={text}>Catch weight (kg)</Text>
            <TextInput accessibilityLabel="Catch weight in kilograms" style={input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="Enter actual weight" placeholderTextColor={c.textMuted} />
            {!!sizeLabel(item, kg) && <Text style={text}>{sizeLabel(item, kg)} — size is included in the weight.</Text>}
            <Text style={text}>One mutation + attributes</Text>
            <Text style={[text, { color: c.textMuted, fontSize: 13 }]}>Selecting another mutation replaces the previous one. Attributes can combine.</Text>
            {!!picked.length && <Text style={text}>{picked.join(' · ')}</Text>}
            <TextInput accessibilityLabel="Search modifiers" style={input} value={query} onChangeText={setQuery} placeholder="Search mutations and attributes" placeholderTextColor={c.textMuted} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {Object.keys(table).filter(n => picked.includes(n) || n.toLowerCase().includes(query.toLowerCase())).sort((a,b) => Number(picked.includes(b)) - Number(picked.includes(a)) || a.localeCompare(b)).slice(0, 30).map(name => (
                <TouchableOpacity key={name} accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(name) }} onPress={() => setPicked(p => selectModifier(p, name, table))}
                  style={{ padding: 10, borderRadius: 12, backgroundColor: picked.includes(name) ? c.primary : c.inputBg }}>
                  <Text style={{ color: picked.includes(name) ? c.onPrimary : c.text }}>{name}{table[name].kind === 'attribute' ? ' · attribute' : ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>}
          <Text style={text}>Quantity (1–99){isFish ? ' · identical catches only' : ''}</Text>
          <TextInput accessibilityLabel="Quantity" style={input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          <Text style={text}>Market value per item: {displayValueText(prepared, scale)}</Text>
          {isFish && <Text style={[text, { color: c.textMuted }]}>NPC sale per catch: {sale.error ? 'Enter valid details' : 'C$ ' + (sale.range ? formatFishValue(sale.range.min) + '–' + formatFishValue(sale.range.max) : formatFishValue(sale.value))}. This does not enter the trade total.</Text>}
          <TouchableOpacity accessibilityRole="button" disabled={!valid} onPress={() => onSave(prepared)} style={{ padding: 16, borderRadius: 12, backgroundColor: c.primary, opacity: valid ? 1 : 0.4 }}>
            <Text style={{ color: c.onPrimary, textAlign: 'center', fontWeight: '700' }}>{editing ? 'Save changes' : 'Add to trade'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={{ padding: 18 }}><Text style={[text, { textAlign: 'center' }]}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
