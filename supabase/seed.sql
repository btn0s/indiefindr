SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

\restrict Dy9p3vMTYK38YqbVARlG57tUhkpkCDzLacHetw3meP0eDHH1MekxizjRhBqb4lX

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', '698e2bb4-7f9b-4a51-848a-bb167259f70d', '{"action":"login","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-09-02 19:55:53.157665+00', ''),
	('00000000-0000-0000-0000-000000000000', '6942e574-c782-408e-80b9-730491148d80', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-02 21:33:53.051391+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fb2659df-4068-4f75-8196-dd0f27dee2f3', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-02 21:33:53.052387+00', ''),
	('00000000-0000-0000-0000-000000000000', '1f9c5a75-dc05-48cd-bfeb-2e97fb470019', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 01:34:35.624804+00', ''),
	('00000000-0000-0000-0000-000000000000', '1b84c0a4-0a72-4918-afad-2d784333ed2f', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 01:34:35.625388+00', ''),
	('00000000-0000-0000-0000-000000000000', '80a8da87-4ff6-48e3-8950-87767e977795', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 04:05:51.315619+00', ''),
	('00000000-0000-0000-0000-000000000000', '84953eb3-eb08-42c2-8db2-81588eefcf74', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 04:05:51.318091+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f7ff1a1c-645c-4022-af51-cc8ec0ab8721', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 05:08:41.857511+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b96e7e50-f36a-4770-8d67-46776cf422e4', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 05:08:41.858535+00', ''),
	('00000000-0000-0000-0000-000000000000', '1818457c-1423-4444-93d7-b614c20412cd', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 18:58:19.95181+00', ''),
	('00000000-0000-0000-0000-000000000000', '7dd6988e-b4c5-4965-b4d9-bf0952f617e6', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 18:58:19.953801+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a0ae6751-5089-4065-b457-e3b41399d98b', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 19:57:13.894083+00', ''),
	('00000000-0000-0000-0000-000000000000', '2313e1bb-e45e-43d1-9e7b-38d96f64cf76', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 19:57:13.894657+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd21a695c-3064-4764-abfa-926bb96486a3', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 21:30:35.837303+00', ''),
	('00000000-0000-0000-0000-000000000000', 'eddc7efc-e2a5-46ca-a932-373bc2adec81', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-03 21:30:35.83813+00', ''),
	('00000000-0000-0000-0000-000000000000', '60277748-61c9-4181-8cc7-8102dbcdbcaf', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 00:09:31.652429+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fe9cdbd1-3486-4017-a190-a253838033b9', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 00:09:31.65612+00', ''),
	('00000000-0000-0000-0000-000000000000', '35b4bc6f-27fa-4d1a-8261-a2015ee166e9', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 19:21:16.092149+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fd5ebfff-3fe8-49ba-b25c-c6693ddf3da1', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 19:21:16.093346+00', ''),
	('00000000-0000-0000-0000-000000000000', '401902ed-25cc-4ac4-8ccc-2db15cf88e7c', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 20:23:03.085906+00', ''),
	('00000000-0000-0000-0000-000000000000', '0669565e-c24e-495d-94da-5c8ef648e9eb', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 20:23:03.086748+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e00b4ead-ec62-4e88-9917-e62365c90dbe', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 21:21:20.058821+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f2950ce0-ddd8-428c-abb0-3fba8a1a3bbf', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 21:21:20.060113+00', ''),
	('00000000-0000-0000-0000-000000000000', '651a7ea7-fb18-4482-83b7-b684a3082e06', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 22:19:20.052005+00', ''),
	('00000000-0000-0000-0000-000000000000', '5b97ee84-eb2d-4389-a7ed-a27c5875dc7e', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 22:19:20.052829+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ece73bfe-6e40-46fb-9195-27250eaa032b', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 23:17:51.738211+00', ''),
	('00000000-0000-0000-0000-000000000000', '74367e7c-bc3b-4587-a479-3c448a5a0825', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-04 23:17:51.739685+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f4b1ae18-d77a-49c3-9a86-e6ab86ece357', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 00:16:02.265452+00', ''),
	('00000000-0000-0000-0000-000000000000', '5c54ccf3-31de-40c1-b049-09d3493008f6', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 00:16:02.266261+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd154b194-52de-44a7-9d43-b11dd4192c88', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 01:14:38.951579+00', ''),
	('00000000-0000-0000-0000-000000000000', '91db7057-b518-4bfd-8eeb-9c55db706ee7', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 01:14:38.952342+00', ''),
	('00000000-0000-0000-0000-000000000000', 'd56d706f-d43b-4859-9c8f-c81bb2e7b389', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 02:30:34.725367+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ea55ef84-c5da-424a-a910-0ab1b66accfd', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 02:30:34.726946+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f311a50b-ca67-4f90-a406-3cde2d83a781', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 03:41:07.351214+00', ''),
	('00000000-0000-0000-0000-000000000000', '83c66d6f-1526-4903-89cf-eefc97196a14', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 03:41:07.351969+00', ''),
	('00000000-0000-0000-0000-000000000000', '4e2da3ca-2d29-43c6-bcd5-5862de4c1cf8', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 04:41:51.089133+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f27e172c-6565-41c0-b4f7-6e797d577989', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 04:41:51.091986+00', ''),
	('00000000-0000-0000-0000-000000000000', 'bd369407-64d3-438f-8463-26e2356d3c31', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 16:23:08.744724+00', ''),
	('00000000-0000-0000-0000-000000000000', '2c87929d-01e9-4a57-9e8d-45adb398b721', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 16:23:08.74689+00', ''),
	('00000000-0000-0000-0000-000000000000', '9bd06b60-eda1-41ed-8a14-9c929e732dbf', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 19:31:14.241957+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dd2cc420-19a5-4cb5-b949-1dc055b0dd52', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 19:31:14.243584+00', ''),
	('00000000-0000-0000-0000-000000000000', '497c5890-a68b-48fa-a87a-7214b6de43aa', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 05:41:06.142715+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cd514f3e-c816-4f81-92c3-cef77853caa1', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 05:41:06.143742+00', ''),
	('00000000-0000-0000-0000-000000000000', '52b6e803-6663-4048-b46e-be8d15a0d1c0', '{"action":"token_refreshed","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 06:40:08.441064+00', ''),
	('00000000-0000-0000-0000-000000000000', '029601f2-8368-44bb-adfe-bd327ceb24a0', '{"action":"token_revoked","actor_id":"185f2f83-d63a-4c9b-b4a0-7e4a885799e2","actor_username":"me@me.com","actor_via_sso":false,"log_type":"token"}', '2025-09-05 06:40:08.441984+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', 'authenticated', 'authenticated', 'me@me.com', '$2a$06$kAT0NlA7zkvze3xQciTZ5eCb6Y6dQ0I/qevwAUisj0EYyyfYF9/W2', '2025-09-02 19:54:58.991549+00', NULL, '', NULL, '', '2025-09-02 19:54:58.991549+00', '', '', NULL, '2025-09-02 19:55:53.158455+00', '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2025-09-02 19:54:58.991549+00', '2025-09-05 19:31:14.245606+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '{"sub": "185f2f83-d63a-4c9b-b4a0-7e4a885799e2", "email": "me@me.com", "email_verified": true}', 'email', '2025-09-02 19:54:58.991549+00', '2025-09-02 19:54:58.991549+00', '2025-09-02 19:54:58.991549+00', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag") VALUES
	('b570635e-0264-49e4-b4c8-9faf3b02177a', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '2025-09-02 19:55:53.158498+00', '2025-09-05 19:31:14.247568+00', NULL, 'aal1', NULL, '2025-09-05 19:31:14.247499', 'Next.js Middleware', '172.19.0.1', NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('b570635e-0264-49e4-b4c8-9faf3b02177a', '2025-09-02 19:55:53.160598+00', '2025-09-02 19:55:53.160598+00', 'password', '30db196c-77c0-4317-ba27-781c236a19e9');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 1, 'qqk5p5eiair4', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-02 19:55:53.159168+00', '2025-09-02 21:33:53.052799+00', NULL, 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 2, 'lk5yfyz4hcya', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-02 21:33:53.053747+00', '2025-09-03 01:34:35.625657+00', 'qqk5p5eiair4', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 3, 'pqpin5bake3z', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-03 01:34:35.625992+00', '2025-09-03 04:05:51.319043+00', 'lk5yfyz4hcya', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 4, 'ad7xb7fe6pmd', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-03 04:05:51.320923+00', '2025-09-03 05:08:41.859496+00', 'pqpin5bake3z', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 5, 'fct2dbgu4f57', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-03 05:08:41.860238+00', '2025-09-03 18:58:19.953982+00', 'ad7xb7fe6pmd', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 6, '7xa3bximrjes', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-03 18:58:19.956153+00', '2025-09-03 19:57:13.894922+00', 'fct2dbgu4f57', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 7, 'e7t6rw32slda', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-03 19:57:13.89525+00', '2025-09-03 21:30:35.838499+00', '7xa3bximrjes', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 8, 'zulizcqan7mp', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-03 21:30:35.838907+00', '2025-09-04 00:09:31.656513+00', 'e7t6rw32slda', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 9, 'mhgwywkfxtlk', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-04 00:09:31.658096+00', '2025-09-04 19:21:16.093612+00', 'zulizcqan7mp', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 10, 'f33o6qqpurmh', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-04 19:21:16.094734+00', '2025-09-04 20:23:03.08721+00', 'mhgwywkfxtlk', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 11, 'ayfieurul6kd', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-04 20:23:03.08784+00', '2025-09-04 21:21:20.060416+00', 'f33o6qqpurmh', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 12, 'n4lqnwkbtri3', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-04 21:21:20.060907+00', '2025-09-04 22:19:20.053175+00', 'ayfieurul6kd', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 13, '4x6afvxgotwa', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-04 22:19:20.053506+00', '2025-09-04 23:17:51.740006+00', 'n4lqnwkbtri3', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 14, 'jvhbkvjjthoo', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-04 23:17:51.74059+00', '2025-09-05 00:16:02.266608+00', '4x6afvxgotwa', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 15, 'pty6kjl6efvg', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 00:16:02.267009+00', '2025-09-05 01:14:38.952557+00', 'jvhbkvjjthoo', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 16, 'z6k2n3n4huo5', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 01:14:38.952952+00', '2025-09-05 02:30:34.72866+00', 'pty6kjl6efvg', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 17, 'dteg3ggjf4b7', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 02:30:34.729233+00', '2025-09-05 03:41:07.352351+00', 'z6k2n3n4huo5', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 18, 'uqy5jmu5kb3k', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 03:41:07.353008+00', '2025-09-05 04:41:51.09227+00', 'dteg3ggjf4b7', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 19, 'y2wuvnizfylb', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 04:41:51.09318+00', '2025-09-05 05:41:06.144042+00', 'uqy5jmu5kb3k', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 20, 'wob6j47o7v2q', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 05:41:06.144366+00', '2025-09-05 06:40:08.44238+00', 'y2wuvnizfylb', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 21, 'dt4npj57ewfj', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 06:40:08.442849+00', '2025-09-05 16:23:08.747251+00', 'wob6j47o7v2q', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 22, '2mcico67gc2z', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', true, '2025-09-05 16:23:08.748162+00', '2025-09-05 19:31:14.243865+00', 'dt4npj57ewfj', 'b570635e-0264-49e4-b4c8-9faf3b02177a'),
	('00000000-0000-0000-0000-000000000000', 23, 'qqmstyq5mrm6', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', false, '2025-09-05 19:31:14.244877+00', '2025-09-05 19:31:14.244877+00', '2mcico67gc2z', 'b570635e-0264-49e4-b4c8-9faf3b02177a');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: Profile; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."Profile" ("id", "createdAt", "updatedAt", "displayName", "avatarUrl") VALUES
	('185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '2025-09-02 19:54:58.992', '2025-09-02 19:54:58.992', 'me@me.com', NULL);


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."Project" ("id", "name", "description", "ownerId", "createdAt", "updatedAt") VALUES
	('2d414df5-9a99-4ea0-8861-c81262d0a58e', 'New Project', NULL, '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '2025-09-02 19:55:54.35', '2025-09-02 19:55:54.348');


--
-- Data for Name: File; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."File" ("id", "projectId", "name", "description", "ownerId", "snapshot", "preview", "createdAt", "updatedAt") VALUES
	('28c2c394-f7ad-4df5-82c7-ab2f322f0aae', '2d414df5-9a99-4ea0-8861-c81262d0a58e', 'New File', NULL, '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '{}', 'http://127.0.0.1:54321/storage/v1/object/public/file-previews/185f2f83-d63a-4c9b-b4a0-7e4a885799e2/28c2c394-f7ad-4df5-82c7-ab2f322f0aae/1757101299990.jpeg', '2025-09-02 19:55:55.179', '2025-09-05 19:41:40.033');


--
-- Data for Name: ProjectMember; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('file-previews', 'file-previews', NULL, '2025-09-02 19:54:58.950642+00', '2025-09-02 19:54:58.950642+00', true, false, NULL, NULL, NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata", "level") VALUES
	('648542a4-9806-47c5-a4c9-332dee641789', 'file-previews', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2/28c2c394-f7ad-4df5-82c7-ab2f322f0aae/1757101299990.jpeg', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '2025-09-05 19:41:40.012277+00', '2025-09-05 19:41:40.012277+00', '2025-09-05 19:41:40.012277+00', '{"eTag": "\"2592dedc6f6d3875f7c426caa705b9fc\"", "size": 845518, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2025-09-05T19:41:40.005Z", "contentLength": 845518, "httpStatusCode": 200}', 'baf6303e-a4f2-4684-bc44-806c0d982466', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '{}', 3);


--
-- Data for Name: prefixes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."prefixes" ("bucket_id", "name", "created_at", "updated_at") VALUES
	('file-previews', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2', '2025-09-02 19:55:57.778825+00', '2025-09-02 19:55:57.778825+00'),
	('file-previews', '185f2f83-d63a-4c9b-b4a0-7e4a885799e2/28c2c394-f7ad-4df5-82c7-ab2f322f0aae', '2025-09-02 19:55:57.778825+00', '2025-09-02 19:55:57.778825+00');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 23, true);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict Dy9p3vMTYK38YqbVARlG57tUhkpkCDzLacHetw3meP0eDHH1MekxizjRhBqb4lX

RESET ALL;
