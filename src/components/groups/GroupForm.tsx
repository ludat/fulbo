import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/postgrest";

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
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          createGroup.mutate();
        }}
      >
        <label className="form-field">
          <span>Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="form-field">
          <span>Descripcion</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createGroup.isPending}
          >
            {createGroup.isPending ? "Creando..." : "Crear"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/")}
          >
            Cancelar
          </button>
        </div>
        {createGroup.isError && (
          <p className="error">{createGroup.error.message}</p>
        )}
      </form>
    </div>
  );
}
