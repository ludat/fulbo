import clsx from "clsx";
import { NavLink } from "react-router-dom";
import { InfoTooltip } from "../ui/InfoTooltip";

const tabClass =
  "px-4 py-2 text-sm font-medium no-underline border-b-2 transition-colors inline-flex items-center";
const activeClass = "border-primary text-primary";
const inactiveClass =
  "border-transparent text-text-secondary hover:text-text hover:border-gray-300";

function Tab({
  to,
  tooltip,
  children,
}: {
  to: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        clsx(tabClass, isActive ? activeClass : inactiveClass)
      }
    >
      {children}
      {tooltip && <InfoTooltip text={tooltip} />}
    </NavLink>
  );
}

export function GroupNav({
  groupId,
  isAdmin,
}: {
  groupId: string;
  isAdmin: boolean;
}) {
  return (
    <nav className="border-border mb-6 flex gap-1 border-b">
      <Tab to={`/groups/${groupId}`}>Partidos</Tab>
      <Tab
        to={`/groups/${groupId}/members`}
        tooltip="Gestioná los jugadores y miembros del grupo"
      >
        Jugadores
      </Tab>
      <Tab
        to={`/groups/${groupId}/stats`}
        tooltip="Puntuá a los jugadores para armar equipos más parejos"
      >
        Stats
      </Tab>
      <Tab
        to={`/groups/${groupId}/disponibilidad`}
        tooltip="Marcá en qué horarios podés jugar para coordinar partidos"
      >
        Disponibilidad
      </Tab>
      {isAdmin && <Tab to={`/groups/${groupId}/settings`}>Configuración</Tab>}
    </nav>
  );
}
