import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { collection, getDocs } from "../services/firestoreCompat";
import { auth, db } from "./firebase-config";
import { useDailyQuota } from "../hooks/useDailyQuota";
import { learnIngredients } from "../services/productService";
import { ensureAccount } from "../services/account";
import { trackAnalyzeRequest } from "../services/userMetrics";
import BottomSheetPopup from "../components/BottomSheetPopup";
import errorPlateImg from "../assets/gramix-preview.webp";
import { apiFetch } from "../services/apiClient";
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";
import "./main.css";
import { loadDraft, saveDraft } from '../services/drafts';

export default function ManualEntryPage({ offlineOnly = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dishNameRef = useRef(null);
  const [draftUid] = useState(() => auth.currentUser?.uid);

  const { canTakePhoto, incrementQuota, userLimit } = useDailyQuota(!offlineOnly);

  useEffect(() => {
    if (dishNameRef.current) {
      dishNameRef.current.focus();
    }
  }, []);

  const [dishName, setDishName] = useState(() => loadDraft().dishName);
  const [ingredients, setIngredients] = useState(() => loadDraft().ingredients);
  const [draftSaved, setDraftSaved] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { setDraftSaved(saveDraft({ dishName, ingredients }, draftUid)); }, [dishName, ingredients, draftUid]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const [analyzing, setAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [serverError, setServerError] = useState(false);
  const [showDailyLimit, setShowDailyLimit] = useState(false);
  const [allIngredientNames, setAllIngredientNames] = useState([]);
  const [activeSuggestIndex, setActiveSuggestIndex] = useState(null);
  const [suggestionsAbove, setSuggestionsAbove] = useState(false);
  const inputRefs = useRef({});
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (offlineOnly || !navigator.onLine) return;
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        const accountId = await ensureAccount(user);
        if (!accountId) return;
        const mealsSnap = await getDocs(
          collection(db, "users", accountId, "meals"),
        );
        const nameSet = new Set();
        mealsSnap.docs.forEach((d) => {
          const m = d.data();
          (m.ingredients || []).forEach((ing) => {
            if (ing?.name) nameSet.add(ing.name);
          });
        });
        setAllIngredientNames(
          [...nameSet].sort((a, b) => a.localeCompare(b))
        );
      } catch (e) {
        console.warn("Failed to load ingredient suggestions", e);
      }
    });
    return () => unsub();
  }, [offlineOnly]);

  const addIngredient = () => {
    setIngredients(prev => [...prev, { name: "", weight: "" }]);
  };

  const removeIngredient = (index) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index, field, value) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing));
  };

  const handleIngredientNameFocus = (index) => {
    setActiveSuggestIndex(index);
    const el = inputRefs.current[index];
    if (el) {
      const rect = el.getBoundingClientRect();
      setSuggestionsAbove(rect.bottom + 165 > window.innerHeight);
    }
  };

  const handleIngredientNameChange = (index, value) => {
    updateIngredient(index, "name", value);
    setValidationError("");
    const el = inputRefs.current[index];
    if (el) {
      const rect = el.getBoundingClientRect();
      setSuggestionsAbove(rect.bottom + 165 > window.innerHeight);
    }
  };

  const pickSuggestion = (index, name) => {
    updateIngredient(index, "name", name);
    setActiveSuggestIndex(null);
  };

  const getSuggestions = (index) => {
    const value = (ingredients[index]?.name || "").trim();
    if (value.length === 0) return [];
    const low = value.toLowerCase();
    return allIngredientNames
      .filter((n) => n.toLowerCase().includes(low) && n.toLowerCase() !== low)
      .slice(0, 6);
  };

  const handleSubmit = async () => {
    if (offlineOnly) { setValidationError(t('x_reconnectDraft')); return; }
    if (!navigator.onLine) { setValidationError(t('x_offlineDraft')); return; }
    if (!canTakePhoto()) {
      setShowDailyLimit(true);
      return;
    }

    const trimmedDish = dishName.trim();
    const filledIngredients = ingredients.filter(ing => ing.name.trim() && ing.weight);
    if (!trimmedDish || filledIngredients.length === 0) {
      setValidationError(t('fill_fields_error'));
      return;
    }
    setValidationError("");
    setAnalyzing(true);

    const userIngredients = filledIngredients.map(ing => ({
      name: ing.name.trim(),
      grams: parseFloat(ing.weight),
    }));
    const textDescription = `${trimmedDish}: ${userIngredients.map(i => `${i.name} ${i.grams}g`).join(', ')}`;
    const lang = gramixStorage.get(STORAGE_KEYS.LANG) || "ru";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await apiFetch("/analyze", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textDescription,
          language: lang,
        }),
        signal: controller.signal,
      });

      if (!data || data.error === "unrecognized_dish") {
        setServerError(true);
        return;
      }

        const aiIngredients = (data.ingredients || []).map(ing => ({
          name:     ing.name || "Unknown",
          weight:   Number(ing.weight_g || ing.weight || ing.grams || 0),
          calories: Number(ing.calories || ing.cal || 0),
          protein:  Number(ing.protein || ing.p || 0),
          fat:      Number(ing.fat || ing.f || 0),
          carbs:    Number(ing.carbs || ing.c || 0),
          cal:      Number(ing.calories || ing.cal || 0),
          p:        Number(ing.protein || ing.p || 0),
          f:        Number(ing.fat || ing.f || 0),
          c:        Number(ing.carbs || ing.c || 0)
        }));

        const meal = {
          name:        data.dish_name || data.name || trimmedDish,
          weight:      Number(data.total_weight_g || data.weight || 0),
          calories:    Number(data.calories || 0),
          protein:     Number(data.protein || 0),
          fat:         Number(data.fat || 0),
          carbs:       Number(data.carbs || 0),
          ingredients: aiIngredients,
          image:       null,
          isNew:       true,
          fromDraft:   true,
          draftSnapshot: { uid: draftUid, value: JSON.stringify({ dishName, ingredients }) }
        };

        learnIngredients(aiIngredients, lang);
        incrementQuota();
        trackAnalyzeRequest("manual");
        navigate("/main", { state: { newMeal: meal, direction: 'right' } });
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setValidationError(t('server_error'));
      }
    } finally {
      abortRef.current = null;
      setAnalyzing(false);
    }
  };

  const cancelAnalysis = () => {
    if (abortRef.current) abortRef.current.abort();
    setAnalyzing(false);
  };

  return (
    <div className="manual-entry-page">
      <header className="manual-entry-header">
        <button className="me-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <h1 className="me-title">{t('add_manually')}</h1>
        <div style={{ width: 40 }} />
      </header>

      <div className="me-scroll">
        <p className="gx-draft-status" role="status">{t(!draftSaved ? 'x_draftFailed' : !online ? 'x_offlineDraft' : 'x_draft')}</p>
        <div className="me-photo-placeholder">
          <img src={errorPlateImg} alt="" className="me-photo-img" />
        </div>

        <div className="me-field-block">
          <label className="me-field-label">{t('dish_name_label')}</label>
          <input
            className="me-text-input"
            type="text"
            placeholder={t('dish_name_label')}
            value={dishName}
            ref={dishNameRef}
            onChange={e => { setDishName(e.target.value); setValidationError(""); }}
          />
        </div>

        <div className="me-ingredients-section">
          <label className="me-field-label">{t('ingredients')}</label>
          {ingredients.map((ing, i) => {
            const suggestions = activeSuggestIndex === i ? getSuggestions(i) : [];
            return (
              <div key={i} className="me-ingredient-row">
                <div className="ing-search-wrapper me-ing-name">
                  <input
                    ref={el => { inputRefs.current[i] = el; }}
                    className="me-text-input"
                    type="text"
                    placeholder={t('ingredient_name_label')}
                    value={ing.name}
                    onFocus={() => handleIngredientNameFocus(i)}
                    onBlur={() => setTimeout(() => {
                      setActiveSuggestIndex(prev => (prev === i ? null : prev));
                    }, 150)}
                    onChange={e => handleIngredientNameChange(i, e.target.value)}
                  />
                  {suggestions.length > 0 && (
                    <div className={`ing-search-suggestions${suggestionsAbove ? " above" : ""}`}>
                      {suggestions.map((name) => (
                        <div
                          key={name}
                          className="ing-suggestion-item"
                          onMouseDown={(e) => { e.preventDefault(); pickSuggestion(i, name); }}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="me-text-input me-ing-grams"
                  type="number"
                  placeholder={t('ingredient_grams_label')}
                  value={ing.weight}
                  onChange={e => { updateIngredient(i, 'weight', e.target.value); setValidationError(""); }}
                />
                {ingredients.length > 1 && (
                  <button className="me-remove-btn" onClick={() => removeIngredient(i)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
          <button className="me-add-ingredient-btn" onClick={addIngredient}>
            + {t('add_ingredient')}
          </button>
        </div>

        {validationError && (
          <p className="me-validation-error">{validationError}</p>
        )}

        <div style={{ height: 100 }} />
      </div>

      <div className="me-footer">
        <button className="me-submit-btn" onClick={handleSubmit} disabled={analyzing}>
          {analyzing ? t('analyzing') : t('request_analysis')}
        </button>
      </div>

      {analyzing && (
        <div className="analyzing-overlay analyzing-overlay--fullscreen">
          <img
            src="/analyzing.png"
            alt=""
            className="analyzing-photo"
          />
          <div className="loading-spinner"></div>
          <h2 className="analyzing-text">{t('analyzing')}</h2>
          <button className="analyzing-cancel-btn" onClick={cancelAnalysis}>
            {t('close')}
          </button>
        </div>
      )}

      <BottomSheetPopup
        open={serverError}
        onClose={() => setServerError(false)}
        variant="error"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        }
        title={t('popup_recognize_title')}
        description={t('popup_recognize_desc')}
        primaryLabel={t('popup_retry')}
        onPrimary={() => setServerError(false)}
        secondaryLabel={t('ok')}
      />

      <BottomSheetPopup
        open={showDailyLimit}
        onClose={() => setShowDailyLimit(false)}
        variant="warning"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        }
        title={t('popup_photo_limit_title')}
        description={t('popup_photo_limit_desc', { limit: userLimit })}
        primaryLabel={t('ok')}
        onPrimary={() => setShowDailyLimit(false)}
      />
    </div>
  );
}
