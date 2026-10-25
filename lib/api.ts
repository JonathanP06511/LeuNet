const API_BASE_URL = 'http://localhost:8000';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export type Difficulty = 'easy' | 'hard';
export type AppRole = 'ADMIN' | 'USER';

// =====================
// AUTH TYPES
// =====================

export interface User {
  id: number;
  name: string;
  email: string;
  role: AppRole | string;
  avatar?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// =====================
// TYPES
// =====================

export interface RandomImageResponse {
  image_id: string;
  image_base64: string;
  true_label: 'ALL' | 'Normal';
  image_path: string;
  difficulty?: Difficulty;
}

export interface EvaluationResponse {
  user_answer: 'ALL' | 'Normal';
  model_prediction: 'ALL' | 'Normal';
  true_label: 'ALL' | 'Normal';
  user_correct: boolean;
  model_correct: boolean;
  model_confidence: number;
  probability_all: number;
  probability_normal: number;
  difficulty?: Difficulty;
}

export interface HealthResponse {
  status: string;
  model_loaded?: boolean;
  uploaded_model_loaded?: boolean;
  uploaded_model_exists?: boolean;
  gradcam_enabled?: boolean;
  gradcam_layer?: string | null;
  all_images_count?: number;
  normal_images_count?: number;
  all_path_exists?: boolean;
  normal_path_exists?: boolean;
  message?: string;
}

export interface ExamQuestion {
  question_number: number;
  image_id: string;
  image_base64: string;
  image_path: string;
  true_label: 'ALL' | 'Normal';
}

export interface ExamStartResponse {
  total_questions: number;
  questions: ExamQuestion[];
  difficulty?: Difficulty;
}

export interface HistoryItem {
  id: number;
  image_id: string | null;
  image_path: string;
  user_answer: 'ALL' | 'Normal' | null;
  model_prediction: 'ALL' | 'Normal' | 'Benign' | 'Leukemia';
  true_label: 'ALL' | 'Normal' | null;
  user_correct: number | null;
  model_correct: number | null;
  model_confidence: number;
  probability_all: number;
  probability_normal: number;
  difficulty: Difficulty | 'uploaded' | string;
  created_at: string;
}

export interface HistoryImages {
  model_prediction: HistoryItem['model_prediction'];
  original_image: string;
  gradcam_heatmap: string | null;
  gradcam_image: string | null;
  gradcam_focus_image: string | null;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: AppRole | string;
  active: number;
  created_at: string;
  avatar?: string | null;
  email_verified?: number;
  // Estadísticas de los análisis de imágenes del usuario.
  analysis_count: number;
  last_analysis_at: string | null;
  leukemia_count: number;
  benign_count: number;
  avg_confidence: number | null;
}

export interface AdminHistoryItem extends HistoryItem {
  user_id: number;
  user_name: string;
  user_email: string;
}

export interface ImageAnalysisResult {
  predicted_class: 'Benign' | 'Leukemia';
  confidence: number;
  probabilities: {
    Benign: number;
    Leukemia: number;
  };
  model_name: string;
  input_size: string;
  threshold?: number;
  gradcam_heatmap?: string | null;
  gradcam_image?: string | null;
  gradcam_focus_image?: string | null;
  gradcam_layer?: string | null;
}

// =====================
// AUTH HELPERS
// =====================

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveSession(auth: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, auth.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

// =====================
// AUTH API CALLS
// =====================

// El registro no inicia sesión: primero se debe verificar el correo con el código enviado.
export async function registerUser(
  name: string,
  email: string,
  password: string,
  avatar?: string | null,
): Promise<{ verification_required: true; email: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, avatar: avatar ?? null }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo registrar el usuario'));
  }

  return response.json();
}

export async function verifyEmail(email: string, code: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo verificar el código'));
  }

  const auth = await response.json();
  saveSession(auth);
  return auth;
}

export async function resendVerificationCode(email: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/resend-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo reenviar el código'));
  }
}

export class EmailNotVerifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailNotVerifiedError';
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 403) {
    throw new EmailNotVerifiedError(await parseError(response, 'Debes verificar tu correo antes de iniciar sesión.'));
  }

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo iniciar sesión'));
  }

  const auth = await response.json();
  saveSession(auth);
  return auth;
}

export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    clearSession();
    throw new Error(await parseError(response, 'Sesión inválida'));
  }

  const user = await response.json();
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/history`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo cargar el historial'));
  }

  return response.json();
}

export async function getHistoryImages(historyId: number): Promise<HistoryImages> {
  const response = await fetch(`${API_BASE_URL}/history/${historyId}/images`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudieron cargar las imágenes del análisis'));
  }

  return response.json();
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudieron cargar los usuarios'));
  }

  return response.json();
}

export async function updateUserRole(userId: number, role: 'ADMIN' | 'USER'): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo cambiar el rol del usuario'));
  }

  return response.json();
}

export async function updateUserActive(userId: number, active: boolean): Promise<{ id: number; active: number }> {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/active`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo cambiar el estado de la cuenta'));
  }

  return response.json();
}

export interface ActivityItem {
  created_at: string;
  user_id: number;
}

export async function getAdminActivity(): Promise<ActivityItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/activity`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo cargar la actividad'));
  }

  const data: { items: ActivityItem[] } = await response.json();
  return data.items;
}

export async function getAdminHistory(): Promise<AdminHistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/admin/history`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo cargar el historial administrativo'));
  }

  return response.json();
}

// =====================
// IMAGE ANALYSIS API
// =====================

export async function analyzeUploadedImage(file: File): Promise<ImageAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/image-analysis/predict`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'No se pudo analizar la imagen'));
  }

  return response.json();
}

// =====================
// API CALLS
// =====================

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error('Failed to connect to API');
  }

  return response.json();
}

export async function getRandomImage(
  difficulty: Difficulty = 'easy'
): Promise<RandomImageResponse> {
  const response = await fetch(
    `${API_BASE_URL}/random-image?difficulty=${difficulty}`,
    { headers: authHeaders() }
  );

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to get random image'));
  }

  return response.json();
}

export async function evaluateAnswer(
  imagePath: string,
  userAnswer: 'ALL' | 'Normal',
  difficulty: Difficulty = 'easy'
): Promise<EvaluationResponse> {
  const response = await fetch(`${API_BASE_URL}/evaluate?difficulty=${difficulty}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      image_path: imagePath,
      user_answer: userAnswer,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to evaluate answer'));
  }

  return response.json();
}

export async function startExam(
  numQuestions: number = 10,
  difficulty: Difficulty = 'easy'
): Promise<ExamStartResponse> {
  const response = await fetch(
    `${API_BASE_URL}/exam/start?num_questions=${numQuestions}&difficulty=${difficulty}`,
    { headers: authHeaders() }
  );

  if (!response.ok) {
    throw new Error(await parseError(response, 'Failed to start exam'));
  }

  return response.json();
}
