"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { demoCreateChallengeDraft } from "@/features/create-challenge/data/demo-draft";
import type {
  CreateChallengeDraftState,
  CreateChallengeStepId,
} from "@/types/create-challenge";

const STORAGE_KEY = "ccn:create-challenge-demo-draft";

type CreateChallengeAction =
  | { type: "hydrate"; payload: CreateChallengeDraftState }
  | { type: "set-step"; payload: CreateChallengeStepId }
  | { type: "reset-demo" };

type CreateChallengeContextValue = {
  state: CreateChallengeDraftState;
  setCurrentStep: (step: CreateChallengeStepId) => void;
  resetDemoDraft: () => void;
};

const CreateChallengeContext =
  createContext<CreateChallengeContextValue | null>(null);

function reducer(
  state: CreateChallengeDraftState,
  action: CreateChallengeAction,
): CreateChallengeDraftState {
  switch (action.type) {
    case "hydrate":
      return action.payload;
    case "set-step":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          currentStep: action.payload,
        },
      };
    case "reset-demo":
      return demoCreateChallengeDraft;
    default:
      return state;
  }
}

function readStoredDraft(): CreateChallengeDraftState | null {
  try {
    const rawDraft = window.sessionStorage.getItem(STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as CreateChallengeDraftState) : null;
  } catch {
    return null;
  }
}

export function CreateChallengeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, demoCreateChallengeDraft);

  useEffect(() => {
    const storedDraft = readStoredDraft();
    if (storedDraft) {
      dispatch({ type: "hydrate", payload: storedDraft });
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<CreateChallengeContextValue>(
    () => ({
      state,
      setCurrentStep: (step) => dispatch({ type: "set-step", payload: step }),
      resetDemoDraft: () => dispatch({ type: "reset-demo" }),
    }),
    [state],
  );

  return (
    <CreateChallengeContext.Provider value={value}>
      {children}
    </CreateChallengeContext.Provider>
  );
}

export function useCreateChallengeDraft() {
  const context = useContext(CreateChallengeContext);

  if (!context) {
    throw new Error(
      "useCreateChallengeDraft must be used within CreateChallengeProvider",
    );
  }

  return context;
}
