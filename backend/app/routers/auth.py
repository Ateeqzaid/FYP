from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from app.config import settings
from pydantic import BaseModel, EmailStr
from typing import Optional
import httpx
import os

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()

supabase_admin: Optional[Client] = None
supabase_anon: Optional[Client] = None


def get_supabase_admin() -> Client:
    global supabase_admin
    if supabase_admin is None:
        try:
            print(f"DEBUG - SUPABASE_URL: {settings.SUPABASE_URL}")
            print(f"DEBUG - SUPABASE_SERVICE_KEY present: {bool(settings.SUPABASE_SERVICE_KEY)}")

            from supabase import ClientOptions
            supabase_admin = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_KEY,
                options=ClientOptions(
                    auto_refresh_token=False,
                    persist_session=False
                )
            )
            print("Admin client created successfully")
        except Exception as e:
            print(f"Error creating admin client: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase client error: {str(e)}"
            )
    return supabase_admin


def get_supabase_anon() -> Client:
    global supabase_anon
    if supabase_anon is None:
        try:
            supabase_anon = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_ANON_KEY
            )
        except Exception as e:
            print(f"Error creating anon client: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase client error: {str(e)}"
            )
    return supabase_anon


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str
    role: str = "student"


class GoogleVerifyRequest(BaseModel):
    id_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RegisterWithGoogle(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"
    google_token: str = ""


@router.post("/google")
async def google_auth(google_data: GoogleAuthRequest):
    try:
        # Verify Google token - try as ID token first, then as access token
        async with httpx.AsyncClient() as client:
            # Try verifying as ID token
            id_verify_response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": google_data.id_token}
            )

            if id_verify_response.status_code == 200:
                token_info = id_verify_response.json()
                # Verify the token is intended for our app
                if token_info.get("aud") != settings.GOOGLE_CLIENT_ID:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token not intended for this application"
                    )
            else:
                # Try verifying as access token via userinfo endpoint
                userinfo_response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {google_data.id_token}"}
                )

                if userinfo_response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid Google token"
                    )

                token_info = userinfo_response.json()

                # For access tokens, verify the azp matches our client
                if token_info.get("sub") is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid Google token - no user identifier"
                    )

            google_email = token_info.get("email")
            google_name = token_info.get("name", "")
            google_sub = token_info.get("sub")

            if not google_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email not provided by Google"
                )

        # Check if user already exists
        supabase = get_supabase_admin()
        existing = supabase.table("profiles").select("*").eq("email", google_email).execute()

        if existing.data:
            # User exists - sign them in
            profile = existing.data[0]
            user_id = profile["id"]

            deterministic_password = f"google_{google_sub}"

            async with httpx.AsyncClient() as client:
                # Try signing in with deterministic password first (works for Google-created users)
                token_response = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
                    headers={
                        "apikey": settings.SUPABASE_ANON_KEY,
                        "Content-Type": "application/json"
                    },
                    json={
                        "email": google_email,
                        "password": deterministic_password
                    }
                )

                # If that fails, reset password via Admin API then sign in
                if token_response.status_code != 200:
                    # Update user password using Admin API
                    update_response = await client.put(
                        f"{settings.SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                        headers={
                            "apikey": settings.SUPABASE_ANON_KEY,
                            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "password": deterministic_password
                        }
                    )

                    if update_response.status_code not in (200, 201):
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not update password for existing user"
                        )

                    # Sign in with the new password
                    token_response = await client.post(
                        f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
                        headers={
                            "apikey": settings.SUPABASE_ANON_KEY,
                            "Content-Type": "application/json"
                        },
                        json={
                            "email": google_email,
                            "password": deterministic_password
                        }
                    )

                    if token_response.status_code != 200:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not generate authentication token"
                        )

                auth_data = token_response.json()

        else:
            # New user - create via Supabase Auth Admin API
            async with httpx.AsyncClient() as client:
                auth_response = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/admin/users",
                    headers={
                        "apikey": settings.SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "email": google_email,
                        "password": f"google_{google_sub}",
                        "email_confirm": True,
                        "user_metadata": {
                            "full_name": google_name,
                            "role": google_data.role
                        }
                    }
                )

                if auth_response.status_code not in (200, 201):
                    error_text = auth_response.text
                    if "already exists" in error_text.lower():
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="An account with this email already exists. Please sign in."
                        )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Auth creation failed: {error_text[:300]}"
                    )

                auth_data = auth_response.json()
                user_id = auth_data.get("id")

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration failed - no user ID returned"
                )

            # Create profile
            async with httpx.AsyncClient() as client:
                profile_response = await client.post(
                    f"{settings.SUPABASE_URL}/rest/v1/profiles",
                    headers={
                        "apikey": settings.SUPABASE_ANON_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json",
                        "Prefer": "return=minimal"
                    },
                    json={
                        "id": user_id,
                        "email": google_email,
                        "full_name": google_name,
                        "role": google_data.role
                    }
                )

                if profile_response.status_code not in (200, 201):
                    print(f"Profile creation warning: {profile_response.status_code} {profile_response.text[:200]}")

            # Sign in the newly created user
            async with httpx.AsyncClient() as client:
                token_response = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
                    headers={
                        "apikey": settings.SUPABASE_ANON_KEY,
                        "Content-Type": "application/json"
                    },
                    json={
                        "email": google_email,
                        "password": f"google_{google_sub}"
                    }
                )

                if token_response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Account created but could not sign in"
                    )

                auth_data = token_response.json()

        access_token = auth_data.get("access_token")
        refresh_token = auth_data.get("refresh_token")

        return {
            "success": True,
            "data": {
                "user": {
                    "id": user_id,
                    "email": google_email,
                    "full_name": google_name,
                    "role": existing.data[0]["role"] if existing.data else google_data.role
                },
                "session": {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "expires_in": auth_data.get("expires_in", 3600),
                    "expires_at": auth_data.get("expires_at")
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Google auth error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google authentication failed: {str(e)[:200]}"
        )


@router.post("/verify-google")
async def verify_google(verify_data: GoogleVerifyRequest):
    try:
        async with httpx.AsyncClient() as client:
            id_verify_response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": verify_data.id_token}
            )

            if id_verify_response.status_code == 200:
                token_info = id_verify_response.json()
                if token_info.get("aud") != settings.GOOGLE_CLIENT_ID:
                    raise HTTPException(status_code=401, detail="Token not intended for this application")
            else:
                userinfo_response = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {verify_data.id_token}"}
                )
                if userinfo_response.status_code != 200:
                    raise HTTPException(status_code=401, detail="Invalid Google token")
                token_info = userinfo_response.json()
                if token_info.get("sub") is None:
                    raise HTTPException(status_code=401, detail="Invalid Google token")

            google_email = token_info.get("email")
            google_name = token_info.get("name", "")

            if not google_email:
                raise HTTPException(status_code=400, detail="Email not provided by Google")

            return {
                "success": True,
                "data": {
                    "email": google_email,
                    "name": google_name
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register")
async def register(user_data: RegisterWithGoogle):
    try:
        # If google_token is provided, verify the email is Google-authenticated
        google_token = getattr(user_data, 'google_token', '')
        if google_token:
            async with httpx.AsyncClient() as client:
                id_verify = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": google_token}
                )
                if id_verify.status_code == 200:
                    token_info = id_verify.json()
                else:
                    userinfo = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {google_token}"}
                    )
                    if userinfo.status_code != 200:
                        raise HTTPException(status_code=401, detail="Invalid Google token")
                    token_info = userinfo.json()

                verified_email = token_info.get("email")
                if not verified_email or verified_email.lower() != user_data.email.lower():
                    raise HTTPException(
                        status_code=400,
                        detail="Email does not match Google-authenticated email"
                    )
        else:
            # Registration without Google token is rejected
            raise HTTPException(
                status_code=400,
                detail="Google email verification is required to register"
            )

        print(f"Registering user: {user_data.email}")

        # Use direct HTTP call to Supabase Auth Admin API
        async with httpx.AsyncClient() as client:
            auth_response = await client.post(
                f"{settings.SUPABASE_URL}/auth/v1/admin/users",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "email": user_data.email,
                    "password": user_data.password,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": user_data.full_name,
                        "role": user_data.role
                    }
                }
            )

            print(f"Auth response status: {auth_response.status_code}")
            print(f"Auth response: {auth_response.text[:500]}")

            if auth_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Auth creation failed: {auth_response.text}"
                )

            auth_data = auth_response.json()
            user_id = auth_data.get("id")

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Registration failed - no user ID returned"
                )

        # Create profile using direct HTTP (PostgreSQL API)
        async with httpx.AsyncClient() as client:
            profile_response = await client.post(
                f"{settings.SUPABASE_URL}/rest/v1/profiles",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                json={
                    "id": user_id,
                    "email": user_data.email,
                    "full_name": user_data.full_name,
                    "role": user_data.role
                }
            )

            print(f"Profile response status: {profile_response.status_code}")
            print(f"Profile response: {profile_response.text[:200]}")

        return {
            "success": True,
            "message": "User registered successfully",
            "data": {
                "user_id": user_id,
                "email": user_data.email
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/refresh")
async def refresh_token(token_data: RefreshTokenRequest):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                json={"refresh_token": token_data.refresh_token}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired refresh token"
                )

            auth_data = response.json()

            return {
                "success": True,
                "data": {
                    "access_token": auth_data.get("access_token"),
                    "refresh_token": auth_data.get("refresh_token"),
                    "expires_in": auth_data.get("expires_in", 3600),
                    "expires_at": auth_data.get("expires_at")
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token refresh failed: {str(e)[:200]}"
        )


@router.post("/login")
async def login(login_data: LoginRequest):
    try:
        print(f"Login attempt for: {login_data.email}")

        # Sign in with password using direct HTTP
        async with httpx.AsyncClient() as client:
            auth_response = await client.post(
                f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "email": login_data.email,
                    "password": login_data.password
                }
            )

            print(f"Login response status: {auth_response.status_code}")
            print(f"Login response: {auth_response.text[:500]}")

            if auth_response.status_code != 200:
                error_detail = auth_response.text
                # Try to extract more specific error from Supabase response
                try:
                    error_json = auth_response.json()
                    error_detail = error_detail.get("error_description") or error_json.get("msg") or error_detail
                except:
                    pass
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Authentication failed: {error_detail[:200]}"
                )

            auth_data = auth_response.json()
            print(f"Auth data keys: {auth_data.keys()}")

            # Supabase Auth returns user info at different levels depending on version
            # Try nested "user" first, then check top-level
            user_id = auth_data.get("user", {}).get("id") if auth_data.get("user") else None
            if not user_id:
                # Check if user info is at top level
                user_id = auth_data.get("id")
            if not user_id:
                # Check user subobject
                user_obj = auth_data.get("user", {})
                if isinstance(user_obj, dict):
                    user_id = user_obj.get("id")

            access_token = auth_data.get("access_token")
            refresh_token = auth_data.get("refresh_token")

            print(f"Extracted user_id: {user_id}")

            if not user_id or not access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials - no user ID in response"
                )

        # Get profile using Supabase anon client (for token verification)
        profile = None
        try:
            supabase_anon_client = get_supabase_anon()
            profile_response = supabase_anon_client.table("profiles").select("*").eq("id", user_id).execute()
            print(f"Profile query result: {profile_response.data}")
            profile = profile_response.data[0] if profile_response.data else None
        except Exception as e:
            print(f"Warning: Could not fetch profile from DB: {e}")
            # Fallback to user metadata
            user_obj = auth_data.get("user", {})
            if isinstance(user_obj, dict):
                user_metadata = user_obj.get("user_metadata", {})
                profile = {
                    "full_name": user_metadata.get("full_name"),
                    "role": user_metadata.get("role", "student")
                }

        return {
            "success": True,
            "data": {
                "user": {
                    "id": user_id,
                    "email": login_data.email,
                    "full_name": profile.get("full_name") if profile and profile.get("full_name") else None,
                    "role": profile.get("role") if profile and profile.get("role") else "student"
                },
                "session": {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "expires_in": auth_data.get("expires_in", 3600),
                    "expires_at": auth_data.get("expires_at")
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Login failed: {str(e)[:200]}"
        )


@router.get("/me")
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    supabase = get_supabase_anon()

    try:
        # Verify token
        user_response = supabase.auth.get_user(credentials.credentials)
        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        # Get profile
        profile = None
        try:
            profile_response = supabase.table("profiles").select("*").eq(
                "id", user_response.user.id
            ).execute()
            profile = profile_response.data[0] if profile_response.data else None
        except Exception as e:
            print(f"Warning: Could not fetch profile from DB in get_me: {e}")
            user_metadata = getattr(user_response.user, 'user_metadata', {})
            profile = {
                "full_name": user_metadata.get("full_name"),
                "role": user_metadata.get("role", "student")
            }

        return {
            "success": True,
            "data": {
                "user": {
                    "id": user_response.user.id,
                    "email": user_response.user.email,
                    "full_name": profile.get("full_name") if profile and profile.get("full_name") else None,
                    "role": profile.get("role") if profile and profile.get("role") else "student"
                }
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )