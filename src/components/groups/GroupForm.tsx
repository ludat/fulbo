import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { FormField } from "../ui/FormField";
import { Input, Textarea } from "../ui/Input";

export function GroupForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createGroup = useMutation({
    mutationFn: () =>
      api<{ id: string }[]>("/groups", {
        method: "POST",
        body: {
          name,
          description: description || null,
        },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      navigate(`/groups/${data[0].id}`);
    },
  });

  return (
    <div>
      <h1>Crear Grupo</h1>
      <form
        className="max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          createGroup.mutate();
        }}
      >
        <FormField label="Nombre">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Descripcion">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </FormField>
        <div className="mt-4 flex gap-2">
          <Button type="submit" disabled={createGroup.isPending}>
            {createGroup.isPending ? "Creando..." : "Crear"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/")}
          >
            Cancelar
          </Button>
        </div>
        {createGroup.isError && (
          <p className="text-danger text-sm">{createGroup.error.message}</p>
        )}
      </form>
    </div>
  );
}
