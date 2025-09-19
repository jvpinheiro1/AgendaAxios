import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, TouchableOpacity, View, FlatList, ActivityIndicator, 
  Modal, TextInput, Platform, Alert 
} from 'react-native';
import axios from 'axios';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SquarePen, Trash, Calendar as CalendarIcon, Clock, CalendarPlus, PlusCircle, CalendarCheck2 } from 'lucide-react-native';
import * as ExpoCalendar from 'expo-calendar';
import DateTimePicker from '@react-native-community/datetimepicker';

// Componente do Header Refatorado para Reutilização
const AppHeader = ({ showAddButton, onAddPress }) => (
  <View style={styles.headerContainer}>
    <View style={styles.headerSide} />
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>Compromissos</Text>
    </View>
    <View style={styles.headerSide}>
      {showAddButton && (
        <TouchableOpacity onPress={onAddPress} style={styles.addButton}>
          <PlusCircle color="#007AFF" size={32} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

export default function App() {
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState(null);
  const [modalMode, setModalMode] = useState('create'); 
  const [title, setTitle] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const Status = {
    Pending: 'pending',
    Scheduled: 'scheduled',
    Done: 'done',
  };

  const fetchCommitments = async () => {
    try {
      const response = await axios.get(process.env.EXPO_PUBLIC_API_URL);
      setCommitments(response.data);
    } catch (e) {
      console.error("Erro detalhado ao buscar compromissos:", e);
      Alert.alert("Erro de Rede", "Não foi possível buscar os compromissos. Verifique sua conexão e se a API está online.");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchCommitments();
    (async () => {
      await ExpoCalendar.requestCalendarPermissionsAsync();
    })();
  }, []);
  
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingCommitment(null);
    setTitle('');
    setAnnotation('');
    setDate(new Date());
    setTime(new Date());
    setModalVisible(true);
  };

  // ... (O restante das suas funções continua exatamente igual)
  const handleEdit = (commitment) => {
    setModalMode('edit');
    setEditingCommitment(commitment);
    setTitle(commitment.titulo);
    setAnnotation(commitment.anotacoes);
    const [hours, minutes] = commitment.hora.split(':');
    const commitmentDate = new Date(`${commitment.dia}T00:00:00.000Z`);     
    commitmentDate.setUTCHours(hours, minutes);
    setDate(commitmentDate);
    setTime(commitmentDate);
    setModalVisible(true);
  };
  const handleCancelModal = () => { setModalVisible(false); setEditingCommitment(null); };
  const onDateChange = (event, selectedDate) => { setShowDatePicker(false); if (event.type === 'set') { setDate(selectedDate || date); } };
  const onTimeChange = (event, selectedTime) => { setShowTimePicker(false); if (event.type === 'set') { setTime(selectedTime || time); } };
  const handleCreateSubmit = async () => {
    if (!title) { Alert.alert("Campo Obrigatório", "Por favor, insira um título."); return; }
    const formattedDate = date.toISOString().split('T')[0];
    const formattedTime = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    const newCommitment = { titulo: title, anotacoes: annotation, dia: formattedDate, hora: formattedTime, status: Status.Scheduled };
    try {
      const response = await axios.post(process.env.EXPO_PUBLIC_API_URL, newCommitment);
      setCommitments([...commitments, response.data]); 
      handleCancelModal();
    } catch (error) { console.error("Erro ao criar compromisso:", error.message); Alert.alert("Erro", "Não foi possível criar o compromisso."); }
  };
  const handleUpdateSubmit = async () => {
    if (!editingCommitment) return;
    const formattedDate = date.toISOString().split('T')[0];
    const formattedTime = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    const updatedData = { titulo: title, anotacoes: annotation, dia: formattedDate, hora: formattedTime, status: editingCommitment.status };
    try {
      const response = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/${editingCommitment.id}`, updatedData);
      setCommitments(commitments.map((c) => (c.id === editingCommitment.id ? response.data : c)));
      handleCancelModal();
    } catch (error) { console.error("Erro ao atualizar:", error.message); Alert.alert("Erro", "Não foi possível atualizar o compromisso."); }
  };
  const deleteCommitment = (id) => {
    Alert.alert("Confirmar Exclusão", "Você tem certeza que deseja deletar este compromisso?",
      [ { text: "Cancelar", style: "cancel" }, { text: "Deletar", style: "destructive", onPress: async () => {
            try { await axios.delete(`${process.env.EXPO_PUBLIC_API_URL}/${id}`); setCommitments(commitments.filter(c => c.id !== id));
            } catch (error) { console.error("Erro ao deletar:", error.message); Alert.alert("Erro", "Não foi possível deletar o compromisso."); }
          }
        }
      ]
    );
  };
  const addEventToCalendar = async (item) => {
    const { status } = await ExpoCalendar.getCalendarPermissionsAsync();
    if (status !== 'granted') { Alert.alert("Permissão necessária", "Precisamos de acesso ao seu calendário para adicionar eventos."); return; }
    const [hours, minutes] = item.hora.split(':');
    const startDate = new Date(`${item.dia}T00:00:00.000Z`);
    startDate.setUTCHours(hours); startDate.setUTCMinutes(minutes);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    try {
      const defaultCalendarId = Platform.OS === 'ios' 
        ? (await ExpoCalendar.getDefaultCalendarAsync()).id
        : (await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT))[0].id;
      await ExpoCalendar.createEventAsync(defaultCalendarId, { title: item.titulo, notes: item.anotacoes, startDate: startDate, endDate: endDate, timeZone: 'UTC' });
      Alert.alert("Sucesso!", "O evento foi adicionado ao seu calendário.");
    } catch (error) { console.error("Erro ao adicionar evento:", error); Alert.alert("Erro", "Não foi possível adicionar o evento ao calendário."); }
  };
  const StatusBadge = ({ status }) => {
    const statusStyles = { [Status.Pending]: { backgroundColor: '#FF950020', textColor: '#FF9500', label: 'Pendente' }, [Status.Scheduled]: { backgroundColor: '#007AFF20', textColor: '#007AFF', label: 'Agendado' }, [Status.Done]: { backgroundColor: '#34C75920', textColor: '#34C759', label: 'Concluído' } };
    const currentStatus = statusStyles[status] || statusStyles[Status.Pending];
    return ( <View style={[styles.statusBadge, { backgroundColor: currentStatus.backgroundColor }]}><Text style={[styles.statusText, { color: currentStatus.textColor }]}>{currentStatus.label}</Text></View> );
  };
  const renderCommitment = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{item.titulo}</Text>
        <Text style={styles.annotation}>{item.anotacoes}</Text>
        <View style={styles.dateTimeContainer}><View style={styles.dateTimeItem}><CalendarIcon color="#8E8E93" size={14} /><Text style={styles.dateTimeText}>{new Date(item.dia).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</Text></View><View style={styles.dateTimeItem}><Clock color="#8E8E93" size={14} /><Text style={styles.dateTimeText}>{item.hora}</Text></View></View>
        <StatusBadge status={item.status} />
      </View>
      <View style={styles.actionsContainer}><TouchableOpacity onPress={() => addEventToCalendar(item)} style={styles.iconButton}><CalendarPlus color="#34C759" size={22} /></TouchableOpacity><TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconButton}><SquarePen color="#007AFF" size={22} /></TouchableOpacity><TouchableOpacity onPress={() => deleteCommitment(item.id)} style={styles.iconButton}><Trash color="#FF3B30" size={22} /></TouchableOpacity></View>
    </View>
  );

  if (loading) {
    return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (!loading && commitments.length === 0) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <StatusBar style="auto" />
          <AppHeader showAddButton={false} />
          <View style={styles.emptyStateContainer}>
            <CalendarCheck2 size={80} color="#C7C7CD" />
            <Text style={styles.emptyStateTitle}>Tudo em ordem!</Text>
            <Text style={styles.emptyStateSubtitle}>Você não tem compromissos pendentes. Que tal adicionar um novo?</Text>
            <TouchableOpacity style={styles.emptyStateButton} onPress={handleOpenCreateModal}>
              <Text style={styles.emptyStateButtonText}>Criar Compromisso</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={handleCancelModal}>{/* Modal continua igual */}</Modal>
        <FlatList
          data={commitments}
          keyExtractor={item => item.id}
          renderItem={renderCommitment}
          contentContainerStyle={styles.listContentContainer}
          ListHeaderComponent={
            <AppHeader showAddButton={true} onAddPress={handleOpenCreateModal} />
          }
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSide: {
    width: 50, // Espaço para o botão ou para balancear
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20, // Ajuste de tamanho para um visual mais limpo
    fontWeight: '600', // Um pouco menos pesado que 'bold'
    color: '#1C1C1E',
  },
  // FIM DA ALTERAÇÃO NOS ESTILOS DO HEADER
  addButton: { padding: 8 },
  listContentContainer: { paddingBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginVertical: 8, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, },
  infoContainer: { flex: 1 },
  title: { fontSize: 17, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  annotation: { fontSize: 15, color: '#8E8E93', marginBottom: 12 },
  dateTimeContainer: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  dateTimeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateTimeText: { fontSize: 13, color: '#3C3C43' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '500' },
  actionsContainer: { flexDirection: 'column', justifyContent: 'space-between' },
  iconButton: { padding: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { width: '90%', backgroundColor: '#F2F2F7', borderRadius: 14, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 20 },
  input: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E5EA' },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  pickerButton: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center',},
  pickerButtonText: { fontSize: 16, marginLeft: 10, color: '#1C1C1E' },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
  modalButton: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#E5E5EA', marginRight: 10 },
  saveButton: { backgroundColor: '#007AFF' },
  modalButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelButtonText: { color: '#007AFF' },
  emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyStateTitle: { fontSize: 22, fontWeight: 'bold', color: '#1C1C1E', marginTop: 24 },
  emptyStateSubtitle: { fontSize: 16, color: '#8E8E93', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyStateButton: { backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 100, marginTop: 32 },
  emptyStateButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});