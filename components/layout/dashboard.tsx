"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCheck,
  CirclePause,
  Clock3,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Vote,
} from "lucide-react";
import Avatar from "@/components/cards/avatar";
import NationalPresident from "@/components/cards/national-president";
import PositionPanel from "@/components/cards/position-panel";
import ProjectFooter from "./project-footer";
import ElectionHeader from "./election-header";
import PanelOverview from "./panel-overview";
import StateNavigation from "./state-navigation";
const PresidentDashboard = dynamic(() => import("./president-dashboard"), {
  loading: () => (
    <p className="feature-loading panel" role="status">
      Carregando recurso…
    </p>
  ),
});
import PanelFilters, {
  type PanelView,
  type OfficeFilter,
} from "./panel-filters";
import { BRAZIL_STATES } from "@/lib/brazil-states";
const BrazilProgressMap = dynamic(
  () => import("@/components/charts/brazil-progress-map"),
  {
    loading: () => (
      <p className="feature-loading panel" role="status">
        Carregando recurso…
      </p>
    ),
  },
);
import { defaultWatchlist, DEFAULTS_KEY } from "@/lib/default-watchlist";
const Watchlist = dynamic(() => import("@/components/tracking/watchlist"), {
  loading: () => (
    <p className="feature-loading panel" role="status">
      Carregando recurso…
    </p>
  ),
});
import {
  emptyPreferences,
  municipalRequests,
  municipalKey,
  parsePreferences,
  selectionKey,
  STORAGE_KEY,
} from "@/lib/preferences";
import Ranking from "@/components/rankings/ranking";
import { number, percentage, clock } from "@/lib/formatting";
import { OFFICE_CONFIG } from "@/lib/config";
import { track } from "@/lib/tracking";
import { DisplaySettingsProvider } from "./display-settings";
import PartyPanel from "@/components/rankings/party-panel";
import { useCandidateHistory } from "@/hooks/use-candidate-history";
import TurnoutChart from "@/components/charts/turnout-chart";
import { readSharedPanel } from "@/lib/live-features";
import SharePanel from "@/components/tracking/share-panel";
import CandidateAlerts from "@/components/tracking/candidate-alerts";
import { useCandidateAlerts } from "@/hooks/use-candidate-alerts";
const MunicipalMap = dynamic(
  () => import("@/components/charts/municipal-map"),
  {
    loading: () => (
      <p className="feature-loading panel" role="status">
        Carregando recurso…
      </p>
    ),
  },
);
import MunicipalExcelExport from "@/components/tracking/municipal-excel-export";
const CityVoteExport = dynamic(
  () => import("@/components/tracking/city-vote-export"),
);
const CandidateReportPanel = dynamic(
  () => import("@/components/tracking/candidate-report"),
);
import {
  OFFICES,
  type Office,
  type Candidate,
  type ElectionSnapshot,
  type TrackedCandidate,
  type WatchPreferences,
} from "@/types/election";

function Leader({
  office,
  candidates,
  state,
  uf = "sc",
}: {
  uf?: string;
  office: "president" | "governor" | "senator";
  candidates: Candidate[];
  state?: ElectionSnapshot;
}) {
  const meta = state?.offices[office],
    waiting = !meta || meta.status === "waiting";
  const tie =
    !waiting &&
    office !== "senator" &&
    !candidates.length &&
    !!state?.[office].length;
  return (
    <article className="leader-card panel">
      <div className="leader-heading">
        <span className="eyebrow">
          {OFFICE_CONFIG[office].label.toUpperCase()}
        </span>
        <span className="small muted">
          {office === "senator" ? "2 vagas" : `Em ${uf.toUpperCase()}`}
        </span>
      </div>
      {candidates.length ? (
        candidates.map((c) => (
          <div className="leader-candidate" key={c.id}>
            <Avatar
              name={c.name}
              url={c.photoUrl}
              large={office !== "senator"}
            />
            <div className="leader-data">
              <h3>{c.name}</h3>
              <p className="small muted">
                {c.party} · {c.number}
              </p>
              <strong className="leader-percentage">
                {percentage(c.percentage)}
              </strong>
              <p className="small muted">{number(c.votes)} votos</p>
              {c.officialStatus && (
                <span className="official-pill">{c.officialStatus}</span>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="leader-waiting">
          <div className="ballot-symbol">
            <Vote size={27} strokeWidth={1.2} aria-hidden="true" />
          </div>
          <h3>
            {tie
              ? "Liderança empatada"
              : waiting
                ? "Aguardando apuração"
                : "Aguardando dados oficiais"}
          </h3>
          <p className="small muted">
            {tie
              ? "Consulte o ranking por votos abaixo."
              : "A liderança será exibida com os primeiros resultados."}
          </p>
        </div>
      )}
      <div className="leader-footer">
        <span>
          {waiting
            ? "Totalização não iniciada"
            : meta?.status === "finished"
              ? "Totalização final"
              : "Liderança no resultado atual"}
        </span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </div>
    </article>
  );
}
export default function Dashboard() {
  const [uf, setUf] = useState("sc");
  const [navigation, setNavigation] = useState(0);
  const selectState = useCallback((value: string) => {
    const next = value.toLowerCase();
    if (
      next !== "br" &&
      !BRAZIL_STATES.some((s) => s.uf.toLowerCase() === next)
    )
      return;
    setUf(next);
    setNavigation((value) => value + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("uf", next);
    url.hash = "";
    if (url.href !== window.location.href)
      window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.search)
        .get("uf")
        ?.toLowerCase();
      if (
        value &&
        (value === "br" ||
          BRAZIL_STATES.some((s) => s.uf.toLowerCase() === value))
      )
        setUf(value);
      else setUf("sc");
    };
    const navigate = () => {
      read();
      setNavigation((n) => n + 1);
    };
    void Promise.resolve().then(read);
    window.addEventListener("popstate", navigate);
    window.addEventListener("hashchange", navigate);
    return () => {
      window.removeEventListener("popstate", navigate);
      window.removeEventListener("hashchange", navigate);
    };
  }, []);
  return (
    <DisplaySettingsProvider>
      <div className="country-shell">
        <StateNavigation uf={uf} onSelect={selectState} />
        <div className="country-content">
          {uf === "br" ? (
            <PresidentDashboard onSelectState={selectState} />
          ) : (
            <>
              <div className="state-return">
                <button className="text-link" onClick={() => selectState("br")}>
                  ← Voltar à visão nacional
                </button>
              </div>
              <StateDashboard
                key={`${uf}:${navigation}`}
                uf={uf}
                onSelectState={selectState}
              />
            </>
          )}
        </div>
      </div>
    </DisplaySettingsProvider>
  );
}
function StateDashboard({
  uf,
  onSelectState,
}: {
  uf: string;
  onSelectState: (uf: string) => void;
}) {
  const stateDefinition = BRAZIL_STATES.find((s) => s.uf.toLowerCase() === uf)!;
  const storageKey =
    uf === "sc" ? STORAGE_KEY : `eleicoes-${uf}-2026:preferences:v1`;
  const [snapshot, setSnapshot] = useState<ElectionSnapshot | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15),
    [paused, setPaused] = useState(false);
  const [preferences, setPreferences] =
    useState<WatchPreferences>(emptyPreferences);
  const [ready, setReady] = useState(false),
    [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, TrackedCandidate>>(
    {},
  );
  const [view, setView] = useState<PanelView>("overview"),
    [officeFilter, setOfficeFilter] = useState<OfficeFilter>("all");
  const [reportCandidate, setReportCandidate] = useState<
    import("@/types/election").Candidate | null
  >(null);
  const [pendingOnly, setPendingOnly] = useState(false),
    [shared, setShared] = useState(false);
  const notices = useCandidateAlerts(snapshot, preferences);
  const { history, warning: historyWarning } = useCandidateHistory(
    uf,
    snapshot,
    preferences,
  );
  const snapshotRef = useRef<ElectionSnapshot | null>(null),
    trackingRef = useRef<Record<string, TrackedCandidate>>({});
  const busy = useRef(false),
    controller = useRef<AbortController | null>(null),
    nextUpdate = useRef(0),
    requestId = useRef(0);
  const seedNeeded = useRef(false);
  const regionalQuery = municipalRequests(preferences.regional)
    .map(municipalKey)
    .join(",");
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const incoming = readSharedPanel(window.location.href);
      try {
        if (incoming?.uf === uf) {
          setPreferences(incoming.preferences);
          setShared(true);
          seedNeeded.current = false;
        } else {
          const stored = localStorage.getItem(storageKey);
          if (stored) setPreferences(parsePreferences(JSON.parse(stored)));
          seedNeeded.current =
            uf === "sc" && !localStorage.getItem(DEFAULTS_KEY);
          if (window.location.hash.startsWith("#painel="))
            setStorageWarning(
              "O link compartilhado é inválido. Suas escolhas anteriores foram mantidas.",
            );
        }
      } catch {
        setStorageWarning(
          "Não foi possível recuperar suas escolhas. Você pode montar seu painel novamente.",
        );
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [storageKey, uf]);
  const updatePreferences = useCallback(
    (value: WatchPreferences) => {
      setPreferences(value);
      if (shared) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
        setStorageWarning(null);
      } catch {
        setStorageWarning(
          "Suas escolhas funcionam nesta visita, mas o navegador não permitiu salvá-las.",
        );
      }
    },
    [storageKey, shared],
  );
  function saveShared() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
      if (uf === "sc") localStorage.setItem(DEFAULTS_KEY, "applied");
      setShared(false);
      setStorageWarning(null);
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", url);
    } catch {
      setStorageWarning(
        "Não foi possível salvar. O painel compartilhado continua disponível nesta visita.",
      );
    }
  }
  function restorePersonal() {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);
    try {
      setPreferences(
        parsePreferences(JSON.parse(localStorage.getItem(storageKey) || "{}")),
      );
    } catch {
      setPreferences(emptyPreferences());
    }
    setShared(false);
    seedNeeded.current = false;
  }
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const id = ++requestId.current,
      abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 60_000);
    try {
      const response = await fetch(
        `/api/elections/sc?uf=${uf}${regionalQuery ? `&regional=${encodeURIComponent(regionalQuery)}` : ""}`,
        { cache: "no-store", signal: abort.signal },
      );
      if (!response.ok) throw new Error("Atualização indisponível.");
      let data: ElectionSnapshot = await response.json();
      if (data?.state?.uf !== uf)
        throw new Error("Resposta de outra UF rejeitada.");
      if (
        !data?.offices ||
        !data?.source ||
        !data?.nationalPresident ||
        !data?.municipalResults ||
        !Array.isArray(data.municipalities)
      )
        throw new Error("Resposta inválida.");
      if (id !== requestId.current) return;
      if (seedNeeded.current && data.source.verifiedSignatures) {
        const preset = defaultWatchlist(data);
        if (preset) {
          seedNeeded.current = false;
          updatePreferences(preset);
          try {
            localStorage.setItem(DEFAULTS_KEY, "applied");
          } catch {
            /* Preferences remain usable for this visit. */
          }
        }
      }
      const previous = snapshotRef.current;
      if (
        previous?.source.verifiedSignatures &&
        !data.source.verifiedSignatures
      )
        data = {
          ...previous,
          stale: true,
          checkedAt: data.checkedAt,
          warnings: data.warnings,
        };
      const nextTracking: Record<string, TrackedCandidate> = {};
      for (const office of OFFICES) {
        const prior = previous?.offices[office];
        const updatedAt = data.offices[office].updatedAt;
        if (
          prior?.generation &&
          ((updatedAt && prior.updatedAt && updatedAt < prior.updatedAt) ||
            !data.offices[office].generation)
        ) {
          data[office] = previous![office];
          data.offices[office] = { ...prior, stale: true };
          data.stale = true;
          data.partyResults = {
            ...data.partyResults,
            [office]: previous!.partyResults?.[office] || [],
          };
          data.statistics = {
            ...data.statistics,
            [office]: previous!.statistics?.[office],
          };
          if (office === "governor") data.progress = previous!.progress;
          if (office === "president" || office === "governor")
            data.leaders[office] = previous!.leaders[office];
          if (office === "senator")
            data.leaders.senator = previous!.leaders.senator;
        }
        for (const c of data[office]) {
          const key = selectionKey({ office, candidateId: c.id });
          nextTracking[key] =
            previous &&
            prior?.generation === data.offices[office].generation &&
            trackingRef.current[key]
              ? { ...trackingRef.current[key], candidate: c }
              : track(
                  c,
                  previous?.[office].find((p) => p.id === c.id) || null,
                  data[office],
                );
        }
      }
      for (const [key, result] of Object.entries(data.municipalResults)) {
        const prior = previous?.municipalResults[key];
        if (
          prior?.meta.generation &&
          ((prior.meta.updatedAt &&
            result.meta.updatedAt &&
            result.meta.updatedAt < prior.meta.updatedAt) ||
            (result.stale && !result.meta.generation))
        )
          data.municipalResults[key] = { ...prior, stale: true };
      }
      const priorNational = previous?.nationalPresident;
      if (
        priorNational?.meta.generation &&
        ((priorNational.meta.updatedAt &&
          data.nationalPresident.meta.updatedAt &&
          data.nationalPresident.meta.updatedAt <
            priorNational.meta.updatedAt) ||
          (data.nationalPresident.stale &&
            !data.nationalPresident.meta.generation))
      )
        data.nationalPresident = { ...priorNational, stale: true };
      snapshotRef.current = data;
      trackingRef.current = nextTracking;
      setSnapshot(data);
      setTracking(nextTracking);
      setError(null);
    } catch (e) {
      if (id === requestId.current)
        setError(
          e instanceof DOMException && e.name === "AbortError"
            ? "A consulta demorou mais que o esperado. Tentaremos novamente."
            : "Não foi possível atualizar. Os últimos dados recebidos continuam na tela.",
        );
    } finally {
      clearTimeout(timeout);
      if (id === requestId.current) {
        busy.current = false;
        setLoading(false);
        nextUpdate.current = Date.now() + 15_000;
        setCountdown(15);
      }
    }
  }, [regionalQuery, uf, updatePreferences]);
  const cancelRefresh = useCallback(() => {
    requestId.current++;
    controller.current?.abort();
    busy.current = false;
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refresh();
    });
    const timer = window.setInterval(() => {
      const hidden = document.hidden;
      setPaused(hidden);
      if (hidden || busy.current) return;
      const left = Math.max(
        0,
        Math.ceil((nextUpdate.current - Date.now()) / 1000),
      );
      setCountdown(left);
      if (left === 0) void refresh();
    }, 1000);
    return () => {
      active = false;
      clearInterval(timer);
      cancelRefresh();
    };
  }, [refresh, ready, cancelRefresh]);
  const waiting = snapshot?.status === "waiting";
  const warnings = [
    ...(snapshot?.warnings || []),
    ...(error ? [error] : []),
    ...(storageWarning ? [storageWarning] : []),
  ];
  const showResults = view === "all" || view === "results";
  const selectedOffice = (office: Office) =>
    (officeFilter === "all" || officeFilter === office) &&
    (!pendingOnly || snapshot?.offices[office].status !== "finished");
  const majorOffices = (["president", "governor", "senator"] as const).filter(
    selectedOffice,
  );
  const deputyOffices = (["federalDeputy", "stateDeputy"] as const).filter(
    selectedOffice,
  );
  function showFilters() {
    document
      .getElementById("filtros-painel")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Ir para os resultados
      </a>
      <ElectionHeader
        uf={uf}
        name={stateDefinition.name}
        finished={snapshot?.status === "finished"}
        warning={warnings.length > 0}
      />
      <main id="main" className="container">
        <PanelFilters
          uf={uf}
          stateName={stateDefinition.name}
          view={view}
          office={officeFilter}
          onViewChange={(next) => {
            setView(next);
            showFilters();
          }}
          onOfficeChange={(next) => {
            setOfficeFilter(next);
            showFilters();
          }}
          pending={pendingOnly}
          onPending={setPendingOnly}
          onReset={() => {
            setView("overview");
            setOfficeFilter("all");
            setPendingOnly(false);
            showFilters();
          }}
        />
        <div className="panel-share-tools">
          <SharePanel uf={uf} preferences={preferences} />
        </div>
        {shared && (
          <aside className="shared-panel-notice panel" role="status">
            <div>
              <h2>Você está vendo um painel compartilhado</h2>
              <p className="small muted">
                Seus favoritos salvos continuam preservados. Salve estas
                escolhas para usá-las nas próximas visitas.
              </p>
            </div>
            <div className="tool-actions">
              <button className="add-button" onClick={saveShared}>
                Salvar estas escolhas
              </button>
              <button className="secondary-button" onClick={restorePersonal}>
                Voltar ao meu painel
              </button>
            </div>
          </aside>
        )}
        <section
          className={
            "progress-panel " +
            (view !== "overview" && view !== "all" ? "is-condensed" : "")
          }
          aria-labelledby="progress-title"
        >
          <div className="progress-main">
            <div className="progress-kicker">
              <span className="eyebrow" id="progress-title">
                TOTALIZAÇÃO · {stateDefinition.name.toUpperCase()}
              </span>
              <ShieldCheck size={18} className="accent" />
            </div>
            <div className="progress-value">
              <strong>{percentage(snapshot?.progress.percentage)}</strong>
              <span className="muted small">
                das seções totalizadas
                <br />
                referência: governador
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label={`Seções totalizadas para governador em ${uf.toUpperCase()}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={snapshot?.progress.percentage ?? undefined}
            >
              <span
                style={{ width: `${snapshot?.progress.percentage || 0}%` }}
              />
            </div>
            <p className="small muted">
              {snapshot?.progress.totalSections != null
                ? `${number(snapshot.progress.sections)} de ${number(snapshot.progress.totalSections)} seções`
                : "Consultando a fonte oficial"}
            </p>
          </div>
          <div className="counting-status">
            <div className="status-icon">
              {waiting ? (
                <CirclePause size={22} />
              ) : snapshot?.status === "finished" ? (
                <CheckCheck size={22} />
              ) : (
                <Clock3 size={22} />
              )}
            </div>
            <div>
              <h2>
                {waiting
                  ? "Aguardando início da totalização"
                  : snapshot?.status === "counting"
                    ? "A apuração está em andamento"
                    : snapshot?.status === "finished"
                      ? "Totalização finalizada"
                      : loading
                        ? "Consultando dados oficiais"
                        : "Aguardando disponibilidade do TSE"}
              </h2>
              <p className="muted small">
                {waiting
                  ? "Os votos aparecerão aqui assim que forem divulgados pelo TSE."
                  : "Atualização automática a cada 15 segundos."}
              </p>
            </div>
          </div>
          <div className="refresh-block">
            <button
              className="refresh-button"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              {loading ? "Atualizando…" : "Atualizar agora"}
            </button>
            <p className="small muted">
              Consulta: <span>{clock(snapshot?.checkedAt || null)}</span>
            </p>
            <p className="small muted">
              {paused
                ? "Pausado em segundo plano"
                : loading
                  ? "Buscando atualização"
                  : `Próxima consulta em ${countdown}s`}
            </p>
          </div>
        </section>
        {warnings.length > 0 && (
          <aside className="warning" role="status">
            <TriangleAlert size={18} aria-hidden="true" />
            <div>
              <strong>Atualização com aviso</strong>
              {warnings.map((w, i) => (
                <p key={`${w}-${i}`}>{w}</p>
              ))}
            </div>
          </aside>
        )}
        {view === "overview" && (
          <PanelOverview
            stateName={stateDefinition.name}
            onViewChange={(next) => {
              setView(next);
              showFilters();
            }}
          />
        )}
        {(view === "overview" ||
          (showResults && selectedOffice("president"))) && (
          <NationalPresident data={snapshot?.nationalPresident} />
        )}
        {["all", "results", "turnout"].includes(view) &&
          (!pendingOnly ||
            officeFilter === "all" ||
            selectedOffice(officeFilter)) && (
            <TurnoutChart
              pendingOnly={pendingOnly}
              snapshot={snapshot}
              uf={uf}
              stateName={stateDefinition.name}
              officeFilter={officeFilter}
            />
          )}
        {showResults &&
          (["senator", "federalDeputy", "stateDeputy"] as const)
            .filter(selectedOffice)
            .map((office) => (
              <PositionPanel
                key={office}
                office={office}
                candidates={snapshot?.[office]}
                meta={snapshot?.offices[office]}
                uf={uf}
                stateName={stateDefinition.name}
              />
            ))}
        {showResults && majorOffices.length > 0 && (
          <>
            <div className="section-heading">
              <div>
                <span className="section-tag">PANORAMA ESTADUAL</span>
                <h2>Quem está na frente em {uf.toUpperCase()}?</h2>
              </div>
              <span className="muted small">
                Liderança parcial não significa eleição.
              </span>
            </div>
            <section
              className={`leaders-grid ${majorOffices.length === 1 ? "single-result-grid" : ""}`}
              aria-label={`Lideranças em ${stateDefinition.name}`}
            >
              {majorOffices.map((office) => (
                <Leader
                  key={office}
                  uf={uf}
                  office={office}
                  candidates={
                    office === "senator"
                      ? snapshot?.leaders.senator || []
                      : snapshot?.leaders[office]
                        ? [snapshot.leaders[office]!]
                        : []
                  }
                  state={snapshot || undefined}
                />
              ))}
            </section>
          </>
        )}
        {(["all", "alerts"].includes(view) ||
          (view === "candidates" && notices.alerts.length > 0)) && (
          <CandidateAlerts
            alerts={notices.alerts}
            enabled={notices.enabled}
            onToggle={notices.toggle}
            onClear={notices.clear}
            uf={uf}
          />
        )}{" "}
        {pendingOnly && snapshot && !OFFICES.some(selectedOffice) && (
          <p className="watch-empty panel" role="status">
            Os cargos selecionados já têm totalização final. Desmarque “Somente
            cargos ainda em apuração” para ver os resultados.
          </p>
        )}
        {["all", "candidates", "municipal", "comparison", "history"].includes(
          view,
        ) && (
          <Watchlist
            onReport={(candidate) => {
              setReportCandidate(candidate);
              setView("report");
              showFilters();
            }}
            pendingOnly={pendingOnly}
            uf={uf}
            snapshot={snapshot}
            preferences={preferences}
            tracking={tracking}
            history={history}
            historyWarning={historyWarning}
            onChange={updatePreferences}
            view={
              view === "all"
                ? "all"
                : (view as
                    "candidates" | "municipal" | "comparison" | "history")
            }
            officeFilter={officeFilter}
          />
        )}
        {(view === "all" || view === "parties") && (
          <>
            {(["federalDeputy", "stateDeputy"] as const)
              .filter(selectedOffice)
              .map((office) => (
                <PartyPanel
                  key={office}
                  office={office}
                  uf={uf}
                  parties={snapshot?.partyResults?.[office]}
                  candidates={snapshot?.[office]}
                  meta={snapshot?.offices[office]}
                />
              ))}
            {view === "parties" &&
              officeFilter !== "all" &&
              !deputyOffices.length && (
                <p className="watch-empty panel">
                  Selecione Deputado federal ou{" "}
                  {uf === "df" ? "Deputado distrital" : "Deputado estadual"}{" "}
                  para consultar a votação proporcional por partido.
                </p>
              )}
          </>
        )}
        {showResults && (
          <>
            <div className="section-heading">
              <div>
                <span className="section-tag">RESULTADOS POR CARGO</span>
                <h2>Os rankings de {stateDefinition.name}</h2>
              </div>
              {deputyOffices.length > 0 && (
                <a className="text-link small" href={`#${deputyOffices[0]}`}>
                  Ir para deputados <ArrowUpRight size={14} />
                </a>
              )}
            </div>
            {majorOffices.length > 0 && (
              <section
                className={`major-rankings ${majorOffices.length === 1 ? "single-result-grid" : ""}`}
                aria-label="Rankings majoritários"
              >
                {majorOffices.map((office) => (
                  <Ranking
                    key={office}
                    uf={uf}
                    stateName={stateDefinition.name}
                    office={office}
                    candidates={snapshot?.[office]}
                    meta={snapshot?.offices[office]}
                    highlightedIds={preferences.candidates
                      .filter((s) => s.office === office)
                      .map((s) => s.candidateId)}
                  />
                ))}
              </section>
            )}
            {deputyOffices.length > 0 && (
              <section
                className={`two-columns deputy-section ${deputyOffices.length === 1 ? "single-result-grid" : ""}`}
                aria-label="Rankings de deputados"
              >
                {deputyOffices.map((office) => (
                  <Ranking
                    key={office}
                    uf={uf}
                    stateName={stateDefinition.name}
                    office={office}
                    candidates={snapshot?.[office]}
                    meta={snapshot?.offices[office]}
                    highlightedIds={preferences.candidates
                      .filter((s) => s.office === office)
                      .map((s) => s.candidateId)}
                  />
                ))}
              </section>
            )}
          </>
        )}
        {(view === "all" || view === "municipalMap") && (
          <MunicipalMap uf={uf} snapshot={snapshot} preferences={preferences} />
        )}
        {["all", "municipal", "excel"].includes(view) && (
          <MunicipalExcelExport
            key={`${uf}:${officeFilter}`}
            uf={uf}
            snapshot={snapshot}
            officeFilter={officeFilter}
          />
        )}
        {(view === "all" || view === "cityExport") && (
          <CityVoteExport key={uf} uf={uf} snapshot={snapshot} />
        )}
        {(view === "all" || view === "report") && (
          <CandidateReportPanel
            key={`${uf}:${reportCandidate?.id || "none"}`}
            uf={uf}
            snapshot={snapshot}
            initialCandidate={reportCandidate}
          />
        )}
        {(view === "map" ||
          (view === "all" && selectedOffice("president"))) && (
          <BrazilProgressMap onSelectState={onSelectState} />
        )}
        {(view === "all" || view === "sources") && (
          <section className="source-section" id="fontes">
            <ShieldCheck size={22} className="accent" />
            <div>
              <h2>Direto da fonte oficial</h2>
              <p className="muted small">
                {snapshot?.source.verifiedSignatures
                  ? "Arquivos oficiais do TSE com assinatura digital verificada."
                  : "Os resultados são exibidos somente após a validação da fonte oficial."}{" "}
                Cada cargo e município pode ter um horário de totalização
                diferente.
              </p>
              <details>
                <summary>Consultar arquivos e metodologia</summary>
                <p className="small muted">
                  O progresso do cabeçalho usa as seções totalizadas para
                  governador. Cada ranking mostra o progresso do próprio cargo.
                  Percentuais e situações são os publicados pelo TSE; posições
                  são calculadas por votos nominais, com empates. A primeira
                  comparação aparece após duas atualizações de votação. Ausência
                  de resultado municipal não entra na soma regional.
                </p>
                <ul>
                  {snapshot?.source.files.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
                <a
                  className="text-link small"
                  href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados"
                  target="_blank"
                  rel="noreferrer"
                >
                  Documentação técnica TSE 2026 <ExternalLink size={12} />
                </a>
              </details>
            </div>
          </section>
        )}
      </main>
      <ProjectFooter />
    </>
  );
}
