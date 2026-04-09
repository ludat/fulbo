import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../../api/postgrest";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { BackLink } from "../ui/BackLink";

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
    mutationFn: ({
      name,
      abbreviation,
      description,
      min_rating,
      max_rating,
    }: {
      name: string;
      abbreviation: string;
      description: string;
      min_rating: number;
      max_rating: number;
    }) =>
      api("/player_attributes", {
        method: "POST",
        body: {
          group_id: groupId,
          name,
          abbreviation: abbreviation || null,
          description: description || null,
          display_order: attributes?.length ?? 0,
          min_rating,
          max_rating,
        },
        headers: { Prefer: "return=representation" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["player_attributes", groupId],
      });
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
      queryClient.invalidateQueries({
        queryKey: ["player_attributes", groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["player_ratings", groupId] });
    },
  });

  const updateAttribute = useMutation({
    mutationFn: ({
      id,
      ...fields
    }: {
      id: string;
      name?: string;
      abbreviation?: string | null;
      description?: string | null;
      min_rating?: number;
      max_rating?: number;
    }) =>
      api("/player_attributes", {
        method: "PATCH",
        params: { id: `eq.${id}` },
        body: fields,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["player_attributes", groupId],
      });
    },
  });

  if (isLoading)
    return (
      <div className="text-text-secondary p-8 text-center">Cargando...</div>
    );

  return (
    <div>
      <BackLink to={`/groups/${groupId}`}>&larr; Volver al grupo</BackLink>

      <h1>Atributos</h1>
      <p className="text-text-secondary">
        Defini los atributos en los que se evaluan los jugadores.
      </p>

      <ul className="list-none">
        {attributes?.map((attr) => (
          <AttributeRow
            key={attr.id}
            attribute={attr}
            onDelete={() => deleteAttribute.mutate(attr.id)}
            onUpdate={(fields) =>
              updateAttribute.mutate({ id: attr.id, ...fields })
            }
            disabled={deleteAttribute.isPending || updateAttribute.isPending}
          />
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = newName.trim();
          if (trimmed)
            addAttribute.mutate({
              name: trimmed,
              abbreviation: newAbbreviation.trim(),
              description: newDescription.trim(),
              min_rating: parseInt(newMinRating) || 0,
              max_rating: parseInt(newMaxRating) || 10,
            });
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nuevo atributo (ej: Defensa)"
            className="flex-1"
          />
          <Input
            type="text"
            value={newAbbreviation}
            onChange={(e) => setNewAbbreviation(e.target.value.slice(0, 3))}
            placeholder="Abr"
            className="w-16"
            maxLength={3}
          />
          <Button
            type="submit"
            disabled={!newName.trim() || addAttribute.isPending}
          >
            Agregar
          </Button>
        </div>
        <Input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Descripcion (opcional)"
        />
        <div className="flex items-center gap-2">
          <label>Min:</label>
          <Input
            type="number"
            value={newMinRating}
            onChange={(e) => setNewMinRating(e.target.value)}
            className="w-20"
          />
          <label>Max:</label>
          <Input
            type="number"
            value={newMaxRating}
            onChange={(e) => setNewMaxRating(e.target.value)}
            className="w-20"
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
  onUpdate: (fields: {
    name?: string;
    abbreviation?: string | null;
    description?: string | null;
    min_rating?: number;
    max_rating?: number;
  }) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(attribute.name);
  const [abbreviation, setAbbreviation] = useState(
    attribute.abbreviation ?? "",
  );
  const [description, setDescription] = useState(attribute.description ?? "");
  const [minRating, setMinRating] = useState(String(attribute.min_rating));
  const [maxRating, setMaxRating] = useState(String(attribute.max_rating));

  return (
    <li className="border-border flex flex-col items-stretch border-b py-2">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmedName = name.trim();
            if (!trimmedName) return;
            const fields: {
              name?: string;
              abbreviation?: string | null;
              description?: string | null;
              min_rating?: number;
              max_rating?: number;
            } = {};
            if (trimmedName !== attribute.name) fields.name = trimmedName;
            const trimmedAbbr = abbreviation.trim();
            if (trimmedAbbr !== (attribute.abbreviation ?? ""))
              fields.abbreviation = trimmedAbbr || null;
            const trimmedDesc = description.trim();
            if (trimmedDesc !== (attribute.description ?? ""))
              fields.description = trimmedDesc || null;
            const parsedMin = parseInt(minRating);
            if (!isNaN(parsedMin) && parsedMin !== attribute.min_rating)
              fields.min_rating = parsedMin;
            const parsedMax = parseInt(maxRating);
            if (!isNaN(parsedMax) && parsedMax !== attribute.max_rating)
              fields.max_rating = parsedMax;
            if (Object.keys(fields).length > 0) onUpdate(fields);
            setEditing(false);
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Input
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.slice(0, 3))}
              placeholder="Abr"
              className="w-16"
              maxLength={3}
            />
          </div>
          <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripcion (opcional)"
          />
          <div className="flex items-center gap-2">
            <label>Min:</label>
            <Input
              type="number"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="w-20"
            />
            <label>Max:</label>
            <Input
              type="number"
              value={maxRating}
              onChange={(e) => setMaxRating(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit">
              Guardar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
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
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex w-full items-center justify-between">
          <div>
            <span>{attribute.name}</span>
            {attribute.abbreviation && (
              <Badge variant="member" className="ml-2">
                {attribute.abbreviation}
              </Badge>
            )}
            <span className="text-text-secondary ml-2 text-sm">
              [{attribute.min_rating}–{attribute.max_rating}]
            </span>
            {attribute.description && (
              <p className="text-text-secondary mt-1 text-sm">
                {attribute.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
              disabled={disabled}
            >
              Editar
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={onDelete}
              disabled={disabled}
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
