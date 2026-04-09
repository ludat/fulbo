import clsx from "clsx";
import { useAuth } from "react-oidc-context";

const ctaButton =
  "text-lg px-10 py-3.5 rounded-full font-semibold bg-white text-primary border-none shadow-md transition-all motion-reduce:transition-none cursor-pointer hover:enabled:-translate-y-0.5 hover:enabled:shadow-lg hover:enabled:bg-gray-200 hover:enabled:text-primary-hover";

const features = [
  {
    title: "Grupos",
    description:
      "Creá grupos con tus amigos, agregá jugadores y gestioná todo desde un solo lugar.",
    image: "/screenshots/group.png",
  },
  {
    title: "Partidos",
    description:
      "Agendá partidos, elegí fecha y lugar, y vé de un vistazo tus próximos encuentros.",
    image: "/screenshots/dashboard.png",
  },
  {
    title: "Asistencia",
    description:
      "Confirmá si vas, tal vez o no. Vé quién juega y cuántos van de un vistazo.",
    image: "/screenshots/attendance.png",
  },
  {
    title: "Equipos equilibrados",
    description:
      "Generá equipos balanceados en base a las puntuaciones de cada jugador.",
    image: "/screenshots/teams.png",
  },
  {
    title: "Atributos personalizados",
    description:
      "Definí los atributos en los que se evalúan los jugadores: defensa, ataque, arquero, o lo que quieras.",
    image: "/screenshots/attributes.png",
  },
  {
    title: "Puntuaciones",
    description:
      "Votá y puntuá a los jugadores en cada atributo para armar equipos más parejos.",
    image: "/screenshots/ratings.png",
  },
];

export function LandingPage() {
  const auth = useAuth();

  const handleLogin = () => {
    sessionStorage.setItem(
      "fulbo_return_to",
      window.location.pathname + window.location.search + window.location.hash,
    );
    auth.signinRedirect();
  };

  return (
    <div className="mx-auto p-0">
      <div className="from-primary to-primary-hover bg-gradient-to-br px-6 pt-16 pb-14 text-center text-white">
        <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-white">
          Fulbo
        </h1>
        <p className="mx-auto mb-10 max-w-lg text-xl text-white/85">
          Organizá tus partidos de fútbol con amigos, fácil y rápido.
        </p>
        <button className={ctaButton} onClick={handleLogin}>
          Iniciar sesión
        </button>
      </div>

      <div className="flex flex-col">
        {features.map((f, i) => (
          <div
            className={clsx(
              "mx-auto flex w-full max-w-5xl items-center gap-12 px-8 py-14 max-sm:flex-col max-sm:gap-6 max-sm:px-6 max-sm:py-10",
              i % 2 === 1 && "flex-row-reverse",
              i % 2 !== 0 && "bg-primary/[0.04]",
            )}
            key={f.title}
          >
            <div className="min-w-0 flex-1 max-sm:text-center">
              <h3 className="text-primary mb-3 text-2xl font-bold tracking-tight">
                {f.title}
              </h3>
              <p className="text-text-secondary text-base leading-relaxed">
                {f.description}
              </p>
            </div>
            <div className="min-w-0 flex-[1.5]">
              <img
                src={f.image}
                alt={f.title}
                className="border-border w-full rounded-xl border shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="from-primary to-primary-hover bg-gradient-to-br px-6 py-14 text-center">
        <button className={ctaButton} onClick={handleLogin}>
          Iniciar sesión
        </button>
      </div>
    </div>
  );
}
