import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Pencil, Trash2, Shield, Users } from "lucide-react";
import { useErpAccessProfiles, useCreateProfile, useUpdateProfile, useDeleteProfile, type AccessProfile } from "@/hooks/useErpAccessProfiles";
import AccessProfileForm from "./AccessProfileForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ErpPortalSettings() {
  const { data: profiles, isLoading } = useErpAccessProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccessProfile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingProfile(null);
    setFormOpen(true);
  };

  const handleEdit = (profile: AccessProfile) => {
    setEditingProfile(profile);
    setFormOpen(true);
  };

  const handleSubmit = (data: { nome: string; descricao: string; modules: { module_id: string; api_id: string | null }[] }) => {
    if (editingProfile) {
      updateProfile.mutate({ id: editingProfile.id, ...data }, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      createProfile.mutate(data, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteProfile.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const getModuleCount = (profile: AccessProfile) => {
    const uniqueModules = new Set(profile.modules.map(m => m.module_id));
    return uniqueModules.size;
  };

  const getApiCount = (profile: AccessProfile) => {
    return profile.modules.length;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Perfis de Acesso</CardTitle>
              <CardDescription>
                Controle quais módulos e APIs cada perfil pode visualizar no portal
              </CardDescription>
            </div>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Perfil
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando perfis...</div>
          ) : !profiles?.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum perfil cadastrado. Crie um perfil para controlar o acesso aos endpoints.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map(profile => (
                <Card key={profile.id} className="relative group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm">{profile.nome}</CardTitle>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(profile)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(profile.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {profile.descricao && (
                      <CardDescription className="text-xs">{profile.descricao}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Users className="h-3 w-3" />
                        {getModuleCount(profile)} módulos
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {getApiCount(profile)} permissões
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AccessProfileForm
        open={formOpen}
        onOpenChange={setFormOpen}
        profile={editingProfile}
        onSubmit={handleSubmit}
        submitting={createProfile.isPending || updateProfile.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover perfil de acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              Chaves de API vinculadas a este perfil perderão a restrição e terão acesso completo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
