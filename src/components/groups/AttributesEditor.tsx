import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/postgrest";

type PlayerAttribute = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  abbreviation: string | null;
  display_order: number;
  min_rating: number;
  max_rating: number;
};

export function AttributesEditor() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newAbbreviation, setNewAbbreviation] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newMinRating, setNewMinRating] = useState("0");
  const [newMaxRating, setNewMaxRating] = useState("10");

  const { data: attributes, isLoading } = useQuery({
    queryKey: ["player_attributes", groupId],
    queryFn: () =>
      api<PlayerAttribute[]>("/player_attributes", {
        params: {
          group_id: `eq.${groupId}`,
          order: "display_order.asc,name.asc",
        },
      }),
  });

  const addAttribute = useMutation({
    mutationFn: ({ name, abbreviation, description, min_rating, max_rating }: { name: string; abbreviation: string; description: string; min_rating: number; max_rating: number }) =>
      api("/player_attributes", {
        method: "POST",
        body: {
          group_id: groupId,
          name,
          abbreviation: abbreviation || null,
          description: description || null,
          display_order: (attributes?.length ?? 0),
          min_rating,
          max_rating,
        },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_attributes", groupId] });
      setNewName("");
      setNewAbbreviation("");
      setNewDescription("");
      setNewMinRating("0");
      setNewMaxRating("10");
    },
  });

  const deleteAttribute = useMutation({
    mutationFn: (attrId: string) =>
      api("/player_attributes", {
        method: "DELETE",
        params: { id: `eq.${attrId}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_attributes", groupId] });
      queryClient.invalidateQueries({ queryKey: ["player_ratings", groupId] });
    },
  });

  const updateAttribute = useMutation({
    mutationFn: ({ id, ...fields }: { id: string; name?: string; abbreviation?: string | null; description?: string | null; min_rating?: number; max_rating?: number }) =>
      api("/player_attributes", {
        method: "PATCH",
        params: { id: `eq.${id}` },
        body: fields,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_attributes", groupId] });
    },
  });

  if (isLoading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <div className="page-header">
        <Link to={`/groups/${groupId}`} className="back-link">
          &larr; Volver al grupo
        </Link>
      </div>

      <h1>Atributos</h1>
      <p className="subtitle">
        Defini los atributos en los que se evaluan los jugadores.
      </p>

      <ul className="member-list">
        {attributes?.map((attr) => (
          <AttributeRow
            key={attr.id}
            attribute={attr}
            onDelete={() => deleteAttribute.mutate(attr.id)}
            onUpdate={(fields) => updateAttribute.mutate({ id: attr.id, ...fields })}
            disabled={deleteAttribute.isPending || updateAttribute.isPending}
          />
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = newName.trim();
          if (trimmed) addAttribute.mutate({ name: trimmed, abbreviation: newAbbreviation.trim(), description: newDescription.trim(), min_rating: parseInt(newMinRating) || 0, max_rating: parseInt(newMaxRating) || 10 });
        }}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}
      >
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuevo atributo (ej: Defensa)"
            className="input"
            style={{ flex: 1 }}
          />
          <input
            type="text"
            value={newAbbreviation}
            onChange={(e) => setNewAbbreviation(e.target.value.slice(0, 3))}
            placeholder="Abr"
            className="input"
            style={{ width: "4rem" }}
            maxLength={3}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!newName.trim() || addAttribute.isPending}
          >
            Agregar
          </button>
        </div>
        <input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Descripcion (opcional)"
          className="input"
        />
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label>Min:</label>
          <input
            type="number"
            value={newMinRating}
            onChange={(e) => setNewMinRating(e.target.value)}
            className="input"
            style={{ width: "5rem" }}
          />
          <label>Max:</label>
          <input
            type="number"
            value={newMaxRating}
            onChange={(e) => setNewMaxRating(e.target.value)}
            className="input"
            style={{ width: "5rem" }}
          />
        </div>
      </form>
    </div>
  );
}

function AttributeRow({
  attribute,
  onDelete,
  onUpdate,
  disabled,
}: {
  attribute: PlayerAttribute;
  onDelete: () => void;
  onUpdate: (fields: { name?: string; abbreviation?: string | null; description?: string | null; min_rating?: number; max_rating?: number }) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(attribute.name);
  const [abbreviation, setAbbreviation] = useState(attribute.abbreviation ?? "");
  const [description, setDescription] = useState(attribute.description ?? "");
  const [minRating, setMinRating] = useState(String(attribute.min_rating));
  const [maxRating, setMaxRating] = useState(String(attribute.max_rating));

  return (
    <li className="member-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmedName = name.trim();
            if (!trimmedName) return;
            const fields: { name?: string; abbreviation?: string | null; description?: string | null; min_rating?: number; max_rating?: number } = {};
            if (trimmedName !== attribute.name) fields.name = trimmedName;
            const trimmedAbbr = abbreviation.trim();
            if (trimmedAbbr !== (attribute.abbreviation ?? "")) fields.abbreviation = trimmedAbbr || null;
            const trimmedDesc = description.trim();
            if (trimmedDesc !== (attribute.description ?? "")) fields.description = trimmedDesc || null;
            const parsedMin = parseInt(minRating);
            if (!isNaN(parsedMin) && parsedMin !== attribute.min_rating) fields.min_rating = parsedMin;
            const parsedMax = parseInt(maxRating);
            if (!isNaN(parsedMax) && parsedMax !== attribute.max_rating) fields.max_rating = parsedMax;
            if (Object.keys(fields).length > 0) onUpdate(fields);
            setEditing(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              style={{ flex: 1 }}
              autoFocus
            />
            <input
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.slice(0, 3))}
              placeholder="Abr"
              className="input"
              style={{ width: "4rem" }}
              maxLength={3}
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripcion (opcional)"
            className="input"
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label>Min:</label>
            <input
              type="number"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="input"
              style={{ width: "5rem" }}
            />
            <label>Max:</label>
            <input
              type="number"
              value={maxRating}
              onChange={(e) => setMaxRating(e.target.value)}
              className="input"
              style={{ width: "5rem" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary btn-sm">
              Guardar
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setName(attribute.name);
                setAbbreviation(attribute.abbreviation ?? "");
                setDescription(attribute.description ?? "");
                setMinRating(String(attribute.min_rating));
                setMaxRating(String(attribute.max_rating));
                setEditing(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <span>{attribute.name}</span>
            {attribute.abbreviation && (
              <span className="badge badge-member" style={{ marginLeft: "0.5rem" }}>{attribute.abbreviation}</span>
            )}
            <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
              [{attribute.min_rating}–{attribute.max_rating}]
            </span>
            {attribute.description && (
              <p className="subtitle" style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem" }}>{attribute.description}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(true)}
              disabled={disabled}
            >
              Editar
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onDelete}
              disabled={disabled}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
