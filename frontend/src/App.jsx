import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, clearSession, getSavedUser, getToken, saveSession } from "./api";

const emptyPokemonForm = {
  name: "",
  type1: "",
  type2: "",
  image_url: "",
  description: ""
};

function typeClass(type) {
  return type ? `type-${String(type).toLowerCase()}` : "";
}

function TypeTag({ type }) {
  if (!type) return null;
  return <span className={`type-tag ${typeClass(type)}`}>{type}</span>;
}

function PokemonImage({ pokemon, className }) {
  if (!pokemon?.image_url) {
    return <div className={className} />;
  }

  return <img className={className} src={pokemon.image_url} alt={pokemon.name} />;
}

function AuthModal({ onLogin, onSkip, notice }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitAuth(event) {
    event.preventDefault();
    setError("");

    const email = form.email.trim();
    const username = form.username.trim();
    const password = form.password;

    if (mode === "register" && !username) {
      setError("Please enter a username.");
      return;
    }

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { username, email, password };

      const data = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify(body)
      });

      saveSession(data.token, data.user);
      onLogin(data.user);
      setForm({ username: "", email: "", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-modal-backdrop">
      <form className="auth-modal-card" onSubmit={submitAuth} noValidate>
        <div className="auth-modal-header">
          <div>
            <h2>{mode === "login" ? "Login" : "Create Account"}</h2>
            <p>{notice || "Login to save teams and keep your own viewed status. You can also skip and browse first."}</p>
          </div>
          <button type="button" className="auth-skip-x" onClick={onSkip} aria-label="Skip login">
            ×
          </button>
        </div>

        <div className="auth-switch">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        {mode === "register" && (
          <input
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
            placeholder="Username"
          />
        )}

        <input
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Email"
          type="email"
        />
        <input
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          placeholder="Password"
          type="password"
          minLength={6}
        />

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="primary-btn" disabled={busy}>
          {busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>

        <button type="button" className="skip-btn" onClick={onSkip}>
          Skip for now
        </button>

        <p className="small-note">You can still browse Pokémon after skipping. My Teams requires login.</p>
      </form>
    </div>
  );
}

function PokemonCard({ pokemon, onOpen }) {
  return (
    <button type="button" className="pokemon-card" onClick={() => onOpen(pokemon)}>
      <PokemonImage pokemon={pokemon} className="pokemon-thumb" />
      <p className="pokemon-number">#{String(pokemon.id).padStart(3, "0")}</p>
      <h3 className="pokemon-name">{pokemon.name}</h3>
      <div className="pokemon-types">
        <TypeTag type={pokemon.type1} />
        <TypeTag type={pokemon.type2} />
      </div>
      <span className={pokemon.viewed ? "status-chip viewed" : "status-chip"}>{pokemon.viewed ? "Viewed" : "Unviewed"}</span>
    </button>
  );
}

function DetailModal({ pokemon, user, isAdmin, isUser, onClose, onToggleViewed, onDelete, onEdit, onAddToTeam, onRequireLogin }) {
  if (!pokemon) return null;

  return (
    <div className="detail-modal">
      <button type="button" aria-label="Close overlay" className="detail-overlay" onClick={onClose} />
      <div className="detail-card">
        <button type="button" className="close-detail-btn" onClick={onClose}>
          ×
        </button>
        <div className="detail-layout">
          <PokemonImage pokemon={pokemon} className="detail-image" />
          <div className="detail-info">
            <h2>
              #{String(pokemon.id).padStart(3, "0")} {pokemon.name}
            </h2>

            <div className="detail-meta">
              <div className="detail-type-row">
                <strong>Type 1:</strong>
                <TypeTag type={pokemon.type1} />
              </div>
              <div className="detail-type-row">
                <strong>Type 2:</strong>
                {pokemon.type2 ? <TypeTag type={pokemon.type2} /> : <span>None</span>}
              </div>
              <div>
                <strong>Status:</strong> {pokemon.viewed ? "Viewed" : "Unviewed"}
              </div>
            </div>

            <div className="detail-description">{pokemon.description || "No description available."}</div>

            <div className="detail-actions">
              {isUser ? (
                <>
                  <button
                    type="button"
                    className={pokemon.viewed ? "unviewed-btn" : "viewed-btn"}
                    onClick={() => onToggleViewed(pokemon.id, !pokemon.viewed)}
                  >
                    {pokemon.viewed ? "Unviewed" : "Viewed"}
                  </button>
                  <button type="button" className="team-btn" onClick={() => onAddToTeam(pokemon)}>
                    Add to Team
                  </button>
                </>
              ) : !user ? (
                <button type="button" className="team-btn" onClick={() => onRequireLogin("Please login as a user to save viewed status and build teams.")}>
                  Login for user features
                </button>
              ) : null}
              {isAdmin && (
                <>
                  <button type="button" className="edit-btn" onClick={() => onEdit(pokemon)}>
                    Edit
                  </button>
                  <button type="button" className="delete-btn" onClick={() => onDelete(pokemon.id)}>
                    Delete
                  </button>
                </>
              )}
            </div>

            {!user && <p className="small-note">You can browse Pokémon after skipping. Team saving and viewed status require a user account.</p>}
            {isAdmin && <p className="small-note">Admin features are separated: admins manage Pokémon data and review users’ saved teams.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PokemonFormModal({ initialValue, onClose, onSubmit }) {
  const [form, setForm] = useState(initialValue || emptyPokemonForm);
  const [error, setError] = useState("");
  const isEdit = Boolean(initialValue?.id);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter the Pokémon name.");
      return;
    }

    if (!form.type1.trim()) {
      setError("Please enter the primary type.");
      return;
    }

    onSubmit({
      ...form,
      name: form.name.trim(),
      type1: form.type1.trim(),
      type2: form.type2.trim() || null,
      image_url: form.image_url.trim() || null,
      description: form.description.trim() || null
    });
  }

  return (
    <div className="form-panel">
      <button type="button" aria-label="Close form" className="form-overlay" onClick={onClose} />
      <div className="form-card">
        <div className="form-header">
          <h2>{isEdit ? "Edit Pokémon" : "Add a Pokémon"}</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="pokemon-form" onSubmit={submit} noValidate>
          <input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Name" />
          <input value={form.type1} onChange={(e) => updateField("type1", e.target.value)} placeholder="Primary type" />
          <input value={form.type2 || ""} onChange={(e) => updateField("type2", e.target.value)} placeholder="Secondary type (optional)" />
          <input value={form.image_url || ""} onChange={(e) => updateField("image_url", e.target.value)} placeholder="Image URL (optional)" />
          <textarea value={form.description || ""} onChange={(e) => updateField("description", e.target.value)} placeholder="Description (optional)" rows={5} />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="primary-btn">
            {isEdit ? "Save changes" : "Add Pokémon"}
          </button>
        </form>
      </div>
    </div>
  );
}

function GuessModal({ pokemon, onClose }) {
  const [current, setCurrent] = useState(null);
  const [guess, setGuess] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [result, setResult] = useState("");
  const [isMovingNext, setIsMovingNext] = useState(false);
  const nextTimerRef = useRef(null);

  function getRandomPokemon(excludeId = null) {
    if (!pokemon.length) return null;

    const availablePokemon =
      excludeId && pokemon.length > 1
        ? pokemon.filter((item) => item.id !== excludeId)
        : pokemon;

    return availablePokemon[Math.floor(Math.random() * availablePokemon.length)];
  }

  function showPokemon(nextPokemon) {
    if (!nextPokemon) return;

    setCurrent(nextPokemon);
    setGuess("");
    setFlipped(false);
    setResult("");
    setIsMovingNext(false);
  }

  function pickRandomInstantly() {
    const nextPokemon = getRandomPokemon();
    showPokemon(nextPokemon);
  }

  function goToNextPokemon() {
    if (!pokemon.length || isMovingNext) return;

    const nextPokemon = getRandomPokemon(current?.id);

    setIsMovingNext(true);

    // First flip the card back to the front side.
    // This prevents the next Pokémon from showing in full image for a short moment.
    setFlipped(false);

    clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => {
      showPokemon(nextPokemon);
    }, 250);
  }

  useEffect(() => {
    pickRandomInstantly();
  }, [pokemon.length]);

  useEffect(() => {
    return () => clearTimeout(nextTimerRef.current);
  }, []);

  function submitGuess() {
    if (!current || isMovingNext) return;

    const userGuess = guess.trim().toLowerCase();
    const correctName = current.name.trim().toLowerCase();

    setResult(
      userGuess && userGuess === correctName
        ? "Correct!"
        : `Wrong. The answer is ${current.name}.`
    );

    setFlipped(true);
  }

  if (!current) return null;

  return (
    <div className="guess-panel">
      <div className="guess-card-panel">
        <div className="guess-header">
          <h2>Who’s That Pokémon?</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="guess-body">
          <div className={flipped ? "guess-flip-card flipped" : "guess-flip-card"}>
            <div className="guess-flip-inner">
              <div className="guess-face guess-front">
                <img
                  className="guess-image silhouette"
                  src={current.image_url || ""}
                  alt="Hidden Pokémon"
                />

                <div className="pokemon-types">
                  <TypeTag type={current.type1} />
                  <TypeTag type={current.type2} />
                </div>

                <div className="guess-description">
                  {current.description || "No description available."}
                </div>

                <input
                  value={guess}
                  onChange={(event) => setGuess(event.target.value)}
                  className="guess-input"
                  placeholder="Guess the Pokémon name..."
                  disabled={isMovingNext}
                />

                <button
                  type="button"
                  className="guess-submit-btn"
                  onClick={submitGuess}
                  disabled={isMovingNext}
                >
                  Submit
                </button>
              </div>

              <div className="guess-face guess-back">
                <img className="guess-image" src={current.image_url || ""} alt={current.name} />
                <h3 className="guess-answer-name">{current.name}</h3>
                <p className="guess-result-text">{result}</p>

                <button
                  type="button"
                  className="guess-submit-btn"
                  onClick={goToNextPokemon}
                  disabled={isMovingNext}
                >
                  {isMovingNext ? "Loading next..." : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PopularTeamsMini({ popularTeams, onCopy, compact = false }) {
  return (
    <div className="popular-inside-builder">
      <div className="section-title-row compact-title-row">
        <div>
          <h3>Popular Teams</h3>
          <p>Generated automatically by grouping public saved teams with the same Pokémon composition.</p>
        </div>
      </div>

      {!popularTeams.length ? (
        <p className="small-note">No public teams have been saved yet.</p>
      ) : (
        <div className="popular-mini-list">
          {popularTeams.slice(0, compact ? 10 : 5).map((team, index) => (
            <div className="popular-mini-card" key={team.team_signature}>
              <div className="popular-mini-header">
                <strong>#{index + 1} Popular Team</strong>
                <span className="count-pill">Used by {team.user_count} user{team.user_count === 1 ? "" : "s"}</span>
              </div>
              <div className="team-members-row compact-members-row">
                {team.pokemon.map((pokemon) => (
                  <div className="team-member" key={`${team.team_signature}-${pokemon.id}`}>
                    <PokemonImage pokemon={pokemon} className="team-member-image" />
                    <span>{pokemon.name}</span>
                  </div>
                ))}
              </div>
              {onCopy && (
                <button type="button" className="team-btn" onClick={() => onCopy(team)}>
                  Copy to Builder
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamBuilder({
  user,
  pokemon,
  currentTeam,
  teamName,
  setTeamName,
  isPublic,
  setIsPublic,
  editingTeamId,
  onAddPokemon,
  onRemove,
  onClear,
  onSave,
  popularTeams,
  onCopyPopular
}) {
  const [builderSearch, setBuilderSearch] = useState("");

  const builderCandidates = useMemo(() => {
    const search = builderSearch.trim().toLowerCase().replace(/^#/, "");

    return pokemon.filter((item) => {
      if (!search) return true;

      const idText = String(item.id);
      const paddedId = String(item.id).padStart(3, "0");
      return item.name.toLowerCase().includes(search) || idText.includes(search) || paddedId.includes(search);
    });
  }, [pokemon, builderSearch]);

  return (
    <section className="page-card builder-page-card">
      <div className="section-title-row">
        <div>
          <h2>Team Builder</h2>
          <p>Search by Pokémon name or Pokédex ID, choose up to 6 Pokémon, then save your team.</p>
        </div>
        <span className="count-pill">{currentTeam.length}/6</span>
      </div>

      {!user && <p className="warning-box">You can build a team after skipping login, but you need to login before saving it or opening My Teams.</p>}

      <div className="team-form-row">
        <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name, e.g. Elite Six" />
        <label className="checkbox-label">
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
          Public team
        </label>
      </div>

      <div className="builder-grid">
        {currentTeam.map((pokemon) => (
          <div className="mini-pokemon-card" key={pokemon.id}>
            <PokemonImage pokemon={pokemon} className="mini-pokemon-image" />
            <strong>#{String(pokemon.id).padStart(3, "0")} {pokemon.name}</strong>
            <button type="button" className="small-danger-btn" onClick={() => onRemove(pokemon.id)}>
              Remove
            </button>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 6 - currentTeam.length) }).map((_, index) => (
          <div className="empty-slot" key={`slot-${index}`}>
            Empty slot
          </div>
        ))}
      </div>

      <div className="detail-actions builder-actions">
        <button type="button" className="team-btn" disabled={!currentTeam.length} onClick={onSave}>
          {editingTeamId ? "Update Loaded Team" : "Save Team"}
        </button>
        <button type="button" className="unviewed-btn" onClick={onClear}>
          Clear Builder
        </button>
      </div>

      <div className="builder-picker-section">
        <div className="section-title-row compact-title-row">
          <div>
            <h3>Choose Pokémon</h3>
            <p>Use the search box to find Pokémon by name or ID, then add them into the team slots above.</p>
          </div>
        </div>

        <input
          className="builder-search-input"
          value={builderSearch}
          onChange={(event) => setBuilderSearch(event.target.value)}
          placeholder="Search by name or ID, e.g. Pikachu, 25, #025"
        />

        <div className="builder-picker-grid">
          {builderCandidates.map((item) => {
            const alreadyAdded = currentTeam.some((member) => member.id === item.id);
            const full = currentTeam.length >= 6;

            return (
              <button
                type="button"
                className={alreadyAdded ? "builder-pokemon-choice selected" : "builder-pokemon-choice"}
                key={item.id}
                onClick={() => onAddPokemon(item)}
                disabled={alreadyAdded || full}
              >
                <PokemonImage pokemon={item} className="builder-choice-image" />
                <span className="builder-choice-id">#{String(item.id).padStart(3, "0")}</span>
                <strong>{item.name}</strong>
                <span className="builder-choice-action">{alreadyAdded ? "Added" : full ? "Full" : "Add"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <PopularTeamsMini popularTeams={popularTeams} onCopy={onCopyPopular} />
    </section>
  );
}

function TeamCard({ team, onLoad, onDelete }) {
  return (
    <div className="team-card">
      <div className="team-card-header">
        <div>
          <h3>{team.team_name}</h3>
          <p>
            {team.is_public ? "Public" : "Private"} · {team.pokemon.length} Pokémon
            {team.created_at ? ` · Saved ${new Date(team.created_at).toLocaleDateString()}` : ""}
          </p>
        </div>
        {team.username && <span className="role-pill">{team.username}</span>}
      </div>

      <div className="team-members-row">
        {team.pokemon.map((pokemon) => (
          <div className="team-member" key={`${team.id}-${pokemon.id}`}>
            <PokemonImage pokemon={pokemon} className="team-member-image" />
            <span>{pokemon.name}</span>
          </div>
        ))}
      </div>

      <div className="detail-actions">
        {onLoad && (
          <button type="button" className="team-btn" onClick={() => onLoad(team)}>
            Load to Builder
          </button>
        )}
        {onDelete && (
          <button type="button" className="delete-btn" onClick={() => onDelete(team.id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function MyTeams({ teams, onLoad, onDelete }) {
  return (
    <section className="page-card">
      <h2>My Teams</h2>
      <p>These are the Pokémon teams saved by the current user.</p>
      {!teams.length ? (
        <p>No saved teams yet.</p>
      ) : (
        <div className="teams-list">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onLoad={onLoad} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}

function AdminUserTeams({ users, allTeams, popularTeams, onDeleteUser, onToggleUserRole }) {
  return (
    <section className="page-card admin-user-teams-page">
      <h2>User's Teams</h2>
      <p>
        This admin view works as the project’s team-building history. It shows which user created which saved team,
        and the popular team ranking is calculated from teams with the same Pokémon composition.
      </p>

      <PopularTeamsMini popularTeams={popularTeams} compact />

      <h3>User Build Team History</h3>
      {!allTeams.length ? (
        <p>No teams have been saved.</p>
      ) : (
        <div className="teams-list">
          {allTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      <h3>Users</h3>
      <p className="small-note">This table is for admin checking and role control.</p>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Teams</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.username}</td>
                <td>{item.email}</td>
                <td>{item.role}</td>
                <td>{item.team_count}</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="small-btn" onClick={() => onToggleUserRole(item)}>
                      Make {item.role === "admin" ? "User" : "Admin"}
                    </button>
                    <button type="button" className="small-danger-btn" onClick={() => onDeleteUser(item.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FloatingActionButton({ label, onClick, active }) {
  return (
    <button type="button" className={active ? "add-btn floating-action-btn active" : "add-btn floating-action-btn"} onClick={onClick}>
      <img src="/pokeball.png" alt="" className="add-btn-icon" />
      <span className="add-btn-text">{label}</span>
    </button>
  );
}

export default function App() {
  const savedUser = getSavedUser();
  const [user, setUser] = useState(savedUser);
  const [showAuthModal, setShowAuthModal] = useState(!savedUser);
  const [authNotice, setAuthNotice] = useState("");
  const [activePage, setActivePage] = useState("pokedex");
  const [pokemon, setPokemon] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [showPokemonForm, setShowPokemonForm] = useState(false);
  const [editingPokemon, setEditingPokemon] = useState(null);
  const [showGuess, setShowGuess] = useState(false);
  const [message, setMessage] = useState("");

  const [currentTeam, setCurrentTeam] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [editingTeamId, setEditingTeamId] = useState(null);

  const [myTeams, setMyTeams] = useState([]);
  const [popularTeams, setPopularTeams] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminTeams, setAdminTeams] = useState([]);

  const isAdmin = user?.role === "admin";
  const isUser = user?.role === "user";

  async function loadPokemon() {
    try {
      const data = await apiFetch("/api/pokemon");
      setPokemon(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshCurrentUser() {
    if (!getToken()) return;

    try {
      const data = await apiFetch("/api/auth/me");
      setUser(data.user);
      localStorage.setItem("pokedex_user", JSON.stringify(data.user));
    } catch {
      clearSession();
      setUser(null);
      setShowAuthModal(true);
    }
  }

  useEffect(() => {
    refreshCurrentUser();
    loadPokemon();
    loadPopularTeams();
  }, []);

  useEffect(() => {
    loadPokemon();
  }, [user?.id]);

  async function loadMyTeams() {
    if (!user) return;
    try {
      const data = await apiFetch("/api/teams/my");
      setMyTeams(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadPopularTeams() {
    try {
      const data = await apiFetch("/api/teams/popular");
      setPopularTeams(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadAdminData() {
    if (!isAdmin) return;
    try {
      const [usersData, teamsData] = await Promise.all([apiFetch("/api/admin/users"), apiFetch("/api/admin/teams")]);
      setAdminUsers(usersData);
      setAdminTeams(teamsData);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (activePage === "myTeams") loadMyTeams();
    if (activePage === "builder" || activePage === "admin") loadPopularTeams();
    if (activePage === "admin") loadAdminData();
  }, [activePage, user?.id]);

  const filteredPokemon = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return pokemon.filter((item) => {
      const matchesSearch = !search || item.name.toLowerCase().includes(search) || String(item.id).includes(search.replace(/^#/, "")) || String(item.id).padStart(3, "0").includes(search.replace(/^#/, ""));
      const matchesFilter = filter === "all" || (filter === "viewed" && item.viewed) || (filter === "not-viewed" && !item.viewed);

      return matchesSearch && matchesFilter;
    });
  }, [pokemon, searchTerm, filter]);

  function handleLogin(nextUser) {
    setUser(nextUser);
    setShowAuthModal(false);
    setAuthNotice("");
    setActivePage(nextUser.role === "admin" ? "admin" : "pokedex");
    flash(`Logged in as ${nextUser.role}.`);
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setActivePage("pokedex");
    setMyTeams([]);
    setAdminTeams([]);
    setAdminUsers([]);
    setShowAuthModal(true);
  }

  function flash(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  }

  function askLogin(text = "Please login first.") {
    setAuthNotice(text);
    setShowAuthModal(true);
  }

  function requireLogin(text) {
    if (user) return true;
    askLogin(text);
    return false;
  }

  async function toggleViewed(id, viewed) {
    if (!requireLogin("Please login to save your own viewed status.")) return;

    try {
      await apiFetch(`/api/pokemon/${id}/viewed`, {
        method: "PUT",
        body: JSON.stringify({ viewed })
      });

      setPokemon((current) => current.map((item) => (item.id === id ? { ...item, viewed } : item)));
      setSelectedPokemon((current) => (current && current.id === id ? { ...current, viewed } : current));
      flash("Viewed status updated.");
    } catch (error) {
      flash(error.message);
    }
  }

  async function savePokemon(form) {
    try {
      if (editingPokemon) {
        await apiFetch(`/api/pokemon/${editingPokemon.id}`, {
          method: "PUT",
          body: JSON.stringify(form)
        });
        flash("Pokémon updated.");
      } else {
        await apiFetch("/api/pokemon", {
          method: "POST",
          body: JSON.stringify(form)
        });
        flash("Pokémon added.");
      }

      setShowPokemonForm(false);
      setEditingPokemon(null);
      setSelectedPokemon(null);
      await loadPokemon();
    } catch (error) {
      flash(error.message);
    }
  }

  async function deletePokemon(id) {
    const confirmed = window.confirm("Are you sure you want to delete this Pokémon?");
    if (!confirmed) return;

    try {
      await apiFetch(`/api/pokemon/${id}`, { method: "DELETE" });
      setSelectedPokemon(null);
      await loadPokemon();
      flash("Pokémon deleted.");
    } catch (error) {
      flash(error.message);
    }
  }

  function addToTeam(item) {
    if (!isUser) {
      askLogin("Please login as a user to build and save teams.");
      return;
    }

    setCurrentTeam((current) => {
      if (current.some((pokemonItem) => pokemonItem.id === item.id)) {
        flash("This Pokémon is already in your builder.");
        return current;
      }

      if (current.length >= 6) {
        flash("A team can only contain 6 Pokémon.");
        return current;
      }

      flash(`${item.name} added to builder.`);
      return [...current, item];
    });

    setActivePage("builder");
  }

  function clearBuilder() {
    setCurrentTeam([]);
    setTeamName("");
    setIsPublic(true);
    setEditingTeamId(null);
  }

  async function saveTeam() {
    if (!requireLogin("Please login before saving your team.")) return;
    if (!isUser) {
      flash("Only normal users can save teams. Admin can review saved teams in User's Teams.");
      return;
    }

    if (!teamName.trim()) {
      flash("Please enter a team name.");
      return;
    }

    if (!currentTeam.length) {
      flash("Please add at least one Pokémon.");
      return;
    }

    try {
      const payload = {
        team_name: teamName,
        pokemon_ids: currentTeam.map((item) => item.id),
        is_public: isPublic
      };

      if (editingTeamId) {
        await apiFetch(`/api/teams/${editingTeamId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        flash("Team updated.");
      } else {
        await apiFetch("/api/teams", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        flash("Team saved.");
      }

      clearBuilder();
      await loadMyTeams();
      await loadPopularTeams();
      setActivePage("myTeams");
    } catch (error) {
      flash(error.message);
    }
  }

  function loadTeamToBuilder(team) {
    const loadedPokemon = team.pokemon.map((member) => pokemon.find((item) => item.id === member.id) || member).filter(Boolean);

    setCurrentTeam(loadedPokemon);
    setTeamName(team.team_name);
    setIsPublic(team.is_public);
    setEditingTeamId(team.id || null);
    setActivePage("builder");
  }

  function copyPopularToBuilder(team) {
    const loadedPokemon = team.pokemon.map((member) => pokemon.find((item) => item.id === member.id) || member).filter(Boolean);

    setCurrentTeam(loadedPokemon);
    setTeamName("My copied popular team");
    setIsPublic(true);
    setEditingTeamId(null);
    setActivePage("builder");
    flash("Popular team copied to builder. Rename it and login before saving if needed.");
  }

  async function deleteTeam(id) {
    const confirmed = window.confirm("Delete this saved team?");
    if (!confirmed) return;

    try {
      await apiFetch(`/api/teams/${id}`, { method: "DELETE" });
      await loadMyTeams();
      await loadPopularTeams();
      flash("Team deleted.");
    } catch (error) {
      flash(error.message);
    }
  }

  async function toggleUserRole(item) {
    const nextRole = item.role === "admin" ? "user" : "admin";
    const confirmed = window.confirm(`Change ${item.username} to ${nextRole}?`);
    if (!confirmed) return;

    try {
      await apiFetch(`/api/admin/users/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ role: nextRole })
      });
      await loadAdminData();
      flash("User role updated.");
    } catch (error) {
      flash(error.message);
    }
  }

  async function deleteUser(id) {
    const confirmed = window.confirm("Delete this user and their teams?");
    if (!confirmed) return;

    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      await loadAdminData();
      flash("User deleted.");
    } catch (error) {
      flash(error.message);
    }
  }

  function openEditPokemon(item) {
    setEditingPokemon(item);
    setShowPokemonForm(true);
  }

  function openMyTeams() {
    if (!user) {
      askLogin("Please login to view My Teams.");
      return;
    }
    if (!isUser) {
      flash("My Teams is for normal users. Admin can review all saved teams in User's Teams.");
      setActivePage("admin");
      return;
    }
    setActivePage("myTeams");
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="title-area">
          <h1 className="title-with-icon">
            Pokedex Tracker
            <img src="/pokedex.png" alt="" className="title-icon" />
          </h1>
          <p>Original Pokedex functions + team builder, saved teams, and high usage team ranking.</p>
        </div>

        <div className="header-actions">
          {user ? (
            <div className="signed-in-chip">
              <div>
                <strong>{user.username}</strong>
                <span className="role-pill">{user.role}</span>
              </div>
              <button type="button" className="small-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <button type="button" className="login-open-btn" onClick={() => askLogin("Login or register to save teams and viewed status.")}>
              Login / Register
            </button>
          )}
        </div>
      </header>

      {message && <div className="toast-message">{message}</div>}

      <div className="floating-buttons">
        <FloatingActionButton label="Pokedex" active={activePage === "pokedex"} onClick={() => setActivePage("pokedex")} />
        {isAdmin && (
          <FloatingActionButton
            label="Add"
            onClick={() => {
              setEditingPokemon(null);
              setShowPokemonForm(true);
            }}
          />
        )}
        {isUser && <FloatingActionButton label="Team Builder" active={activePage === "builder"} onClick={() => setActivePage("builder")} />}
        {isUser && <FloatingActionButton label="My Teams" active={activePage === "myTeams"} onClick={openMyTeams} />}
        {isUser && <FloatingActionButton label="Guess" onClick={() => setShowGuess(true)} />}
        {isAdmin && <FloatingActionButton label="User's Teams" active={activePage === "admin"} onClick={() => setActivePage("admin")} />}
      </div>

      <main className="main-content">
        {activePage === "pokedex" && (
          <section className="pokemon-section">
            <div className="filter-buttons">
              <button type="button" className={filter === "all" ? "filter-btn active" : "filter-btn"} onClick={() => setFilter("all")}>
                All
              </button>
              <button type="button" className={filter === "not-viewed" ? "filter-btn active" : "filter-btn"} onClick={() => setFilter("not-viewed")}>
                Unviewed
              </button>
              <button type="button" className={filter === "viewed" ? "filter-btn active" : "filter-btn"} onClick={() => setFilter("viewed")}>
                Viewed
              </button>
            </div>

            <div className="search-bar">
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by name..." />
            </div>

            <div className="pokemon-list">
              {filteredPokemon.length ? filteredPokemon.map((item) => <PokemonCard key={item.id} pokemon={item} onOpen={setSelectedPokemon} />) : <p>No Pokémon found.</p>}
            </div>
          </section>
        )}

        {activePage === "builder" && isUser && (
          <TeamBuilder
            user={user}
            pokemon={pokemon}
            currentTeam={currentTeam}
            teamName={teamName}
            setTeamName={setTeamName}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
            editingTeamId={editingTeamId}
            onAddPokemon={addToTeam}
            onRemove={(id) => setCurrentTeam((current) => current.filter((item) => item.id !== id))}
            onClear={clearBuilder}
            onSave={saveTeam}
            popularTeams={popularTeams}
            onCopyPopular={copyPopularToBuilder}
          />
        )}

        {activePage === "myTeams" && isUser && <MyTeams teams={myTeams} onLoad={loadTeamToBuilder} onDelete={deleteTeam} />}

        {activePage === "admin" && isAdmin && (
          <AdminUserTeams
            users={adminUsers}
            allTeams={adminTeams}
            popularTeams={popularTeams}
            onDeleteUser={deleteUser}
            onToggleUserRole={toggleUserRole}
          />
        )}
      </main>

      {selectedPokemon && (
        <DetailModal
          pokemon={selectedPokemon}
          user={user}
          isAdmin={isAdmin}
          isUser={isUser}
          onClose={() => setSelectedPokemon(null)}
          onToggleViewed={toggleViewed}
          onDelete={deletePokemon}
          onEdit={openEditPokemon}
          onAddToTeam={addToTeam}
          onRequireLogin={askLogin}
        />
      )}

      {showPokemonForm && isAdmin && (
        <PokemonFormModal
          initialValue={editingPokemon || emptyPokemonForm}
          onClose={() => {
            setShowPokemonForm(false);
            setEditingPokemon(null);
          }}
          onSubmit={savePokemon}
        />
      )}

      {showGuess && isUser && <GuessModal pokemon={pokemon} onClose={() => setShowGuess(false)} />}

      {!user && showAuthModal && <AuthModal onLogin={handleLogin} onSkip={() => setShowAuthModal(false)} notice={authNotice} />}
    </div>
  );
}
