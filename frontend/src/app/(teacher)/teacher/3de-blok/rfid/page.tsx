"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Search,
  CheckCircle,
  XCircle,
  User
} from "lucide-react";
import { rfidService, type RFIDCard } from "@/services/attendance.service";

interface StudentWithCards {
  user_id: number;
  user_name: string;
  user_email: string;
  class_name: string | null;
  cards: RFIDCard[];
}

export default function RFIDAdminPage() {
  const [students, setStudents] = useState<StudentWithCards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState<number | null>(null);
  const [newCardData, setNewCardData] = useState({ uid: "", label: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchStudentsAndCards();
  }, []);

  const fetchStudentsAndCards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // In a real implementation, we'd have an endpoint that returns students with their cards
      // For now, this is a placeholder structure
      // TODO: Implement backend endpoint that returns students with cards
      
      setStudents([]);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError("Kon studenten niet ophalen");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (userId: number) => {
    if (!newCardData.uid.trim()) {
      alert("Vul een RFID UID in");
      return;
    }

    try {
      setSubmitting(true);
      await rfidService.createCard(userId, {
        uid: newCardData.uid,
        label: newCardData.label || undefined,
        is_active: true,
      });
      
      setShowAddForm(null);
      setNewCardData({ uid: "", label: "" });
      fetchStudentsAndCards();
    } catch (err) {
      console.error("Error adding card:", err);
      alert("Fout bij toevoegen kaart - mogelijk bestaat deze UID al");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (cardId: number, currentStatus: boolean) => {
    try {
      await rfidService.updateCard(cardId, { is_active: !currentStatus });
      fetchStudentsAndCards();
    } catch (err) {
      console.error("Error updating card:", err);
      alert("Fout bij bijwerken kaart");
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm("Weet je zeker dat je deze kaart wilt verwijderen?")) {
      return;
    }

    try {
      await rfidService.deleteCard(cardId);
      fetchStudentsAndCards();
    } catch (err) {
      console.error("Error deleting card:", err);
      alert("Fout bij verwijderen kaart");
    }
  };

  const filteredStudents = students.filter((student) =>
    student.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.class_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Studenten laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">RFID Kaarten Beheer</h1>
        <p className="text-gray-600 mt-1">
          Koppel en beheer RFID kaarten voor studenten
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Info Card */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <CreditCard className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Hoe werkt het?</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Koppel een RFID kaart aan een student door de UID in te voeren</li>
              <li>• Een student kan meerdere kaarten hebben (backup kaart)</li>
              <li>• Deactiveer een kaart zonder deze te verwijderen</li>
              <li>• De UID staat op de RFID kaart of kan worden uitgelezen door de scanner</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Search className="h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Zoek student op naam, email of klas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>
      </Card>

      {/* Students List */}
      <div className="space-y-4">
        {filteredStudents.length === 0 ? (
          <Card className="p-12 text-center">
            <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">Geen studenten gevonden</h3>
            <p className="text-gray-500 mt-2">
              {searchTerm ? "Geen studenten met deze zoekopdracht" : "Er zijn nog geen studenten"}
            </p>
          </Card>
        ) : (
          filteredStudents.map((student) => (
            <Card key={student.user_id} className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-700 font-semibold text-lg">
                      {student.user_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{student.user_name}</h3>
                    <p className="text-sm text-gray-600">{student.user_email}</p>
                    {student.class_name && (
                      <Badge variant="outline" className="mt-1">
                        {student.class_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setShowAddForm(student.user_id)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Kaart toevoegen
                </Button>
              </div>

              {/* Add Card Form */}
              {showAddForm === student.user_id && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium mb-3">Nieuwe RFID kaart toevoegen</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        RFID UID *
                      </label>
                      <Input
                        type="text"
                        placeholder="Bijvoorbeeld: ABC123DEF456"
                        value={newCardData.uid}
                        onChange={(e) => setNewCardData({ ...newCardData, uid: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Label (optioneel)
                      </label>
                      <Input
                        type="text"
                        placeholder="Bijvoorbeeld: Hoofdkaart"
                        value={newCardData.label}
                        onChange={(e) => setNewCardData({ ...newCardData, label: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => handleAddCard(student.user_id)}
                      disabled={submitting}
                      size="sm"
                    >
                      {submitting ? "Toevoegen..." : "Toevoegen"}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowAddForm(null);
                        setNewCardData({ uid: "", label: "" });
                      }}
                      variant="outline"
                      size="sm"
                      disabled={submitting}
                    >
                      Annuleren
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards List */}
              {student.cards.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Nog geen RFID kaarten gekoppeld
                </div>
              ) : (
                <div className="space-y-2">
                  {student.cards.map((card) => (
                    <div
                      key={card.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className={`h-5 w-5 ${card.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <div className="font-mono font-medium">{card.uid}</div>
                          {card.label && (
                            <div className="text-sm text-gray-600">{card.label}</div>
                          )}
                        </div>
                        {card.is_active ? (
                          <Badge variant="default" className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Actief
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactief
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleToggleActive(card.id, card.is_active)}
                          variant="outline"
                          size="sm"
                        >
                          {card.is_active ? "Deactiveren" : "Activeren"}
                        </Button>
                        <Button
                          onClick={() => handleDeleteCard(card.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
