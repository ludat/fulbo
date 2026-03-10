import { useAuth } from "react-oidc-context";

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
    <div className="landing">
      <div className="landing-hero">
        <h1 className="landing-title">Fulbo</h1>
        <p className="landing-subtitle">
          Organizá tus partidos de fútbol con amigos, fácil y rápido.
        </p>
        <button className="landing-cta" onClick={handleLogin}>
          Iniciar sesión
        </button>
      </div>

      <div className="landing-features">
        {features.map((f, i) => (
          <div
            className={`landing-feature-row ${i % 2 === 1 ? "landing-feature-row-reverse" : ""}`}
            key={f.title}
          >
            <div className="landing-feature-text">
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
            <div className="landing-feature-img">
              <img src={f.image} alt={f.title} />
            </div>
          </div>
        ))}
      </div>

      <div className="landing-bottom-cta">
        <button className="landing-cta" onClick={handleLogin}>
          Iniciar sesión
        </button>
      </div>
    </div>
  );
}
