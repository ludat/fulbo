import {
  createReactRouterV7Options,
  getWebInstrumentations,
  initializeFaro,
  ReactIntegration,
} from "@grafana/faro-react";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";
import {
  createRoutesFromChildren,
  matchRoutes,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { config } from "./config";

function getEnvironment(): string {
  const hostname = window.location.hostname;
  if (hostname === "localhost") return "local";
  if (hostname === "fulbo.ludat.io") return "prod";
  const match = hostname.match(/^(.+)\.fulbo\.ludat\.io$/);
  if (match) return match[1];
  return hostname;
}

export const faro = config.faroUrl
  ? initializeFaro({
      url: config.faroUrl,
      app: { name: "fulbo", environment: getEnvironment() },
      instrumentations: [
        ...getWebInstrumentations(),
        new TracingInstrumentation(),
        new ReactIntegration({
          router: createReactRouterV7Options({
            createRoutesFromChildren,
            matchRoutes,
            Routes,
            useLocation,
            useNavigationType,
          }),
        }),
      ],
    })
  : undefined;
