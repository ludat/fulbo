export function GroupHeader({
  groupName,
  groupDescription,
}: {
  groupName: string;
  groupDescription: string | null;
}) {
  return (
    <div className="mb-4">
      <h1>{groupName}</h1>
      {groupDescription && (
        <p className="text-text-secondary">{groupDescription}</p>
      )}
    </div>
  );
}
