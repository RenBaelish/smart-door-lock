--
-- PostgreSQL database dump
--

\restrict hUlhYUXoLyMJqeN1LlFDTUwEuW5mEOr5B1zLo0SbSz4pIqVCgyF4nNLrPdzvizs

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg12+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.access_logs DROP CONSTRAINT IF EXISTS access_logs_user_id_fkey;
DROP INDEX IF EXISTS public.ix_class_schedules_kelas;
DROP INDEX IF EXISTS public.ix_class_schedules_day;
DROP INDEX IF EXISTS public.ix_access_logs_user_id;
DROP INDEX IF EXISTS public.ix_access_logs_timestamp;
DROP INDEX IF EXISTS public.ix_access_logs_status;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.class_schedules DROP CONSTRAINT IF EXISTS class_schedules_pkey;
ALTER TABLE IF EXISTS ONLY public.access_logs DROP CONSTRAINT IF EXISTS access_logs_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.class_schedules ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.access_logs ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.class_schedules_id_seq;
DROP TABLE IF EXISTS public.class_schedules;
DROP SEQUENCE IF EXISTS public.access_logs_id_seq;
DROP TABLE IF EXISTS public.access_logs;
DROP EXTENSION IF EXISTS vector;
--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_logs; Type: TABLE; Schema: public; Owner: facelock
--

CREATE TABLE public.access_logs (
    id integer NOT NULL,
    user_id integer,
    status character varying(16) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    confidence_score double precision,
    reason character varying(255),
    image_path character varying(255),
    room character varying(50),
    user_name character varying(100),
    user_role character varying(20),
    user_nim character varying(30),
    user_kelas character varying(30)
);


ALTER TABLE public.access_logs OWNER TO facelock;

--
-- Name: access_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: facelock
--

CREATE SEQUENCE public.access_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.access_logs_id_seq OWNER TO facelock;

--
-- Name: access_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: facelock
--

ALTER SEQUENCE public.access_logs_id_seq OWNED BY public.access_logs.id;


--
-- Name: class_schedules; Type: TABLE; Schema: public; Owner: facelock
--

CREATE TABLE public.class_schedules (
    id integer NOT NULL,
    kelas character varying(30) NOT NULL,
    day character varying(20) NOT NULL,
    slot character varying(30),
    start_time character varying(10) NOT NULL,
    end_time character varying(10) NOT NULL,
    subject character varying(100) NOT NULL,
    lecturer character varying(100) NOT NULL,
    room character varying(50) NOT NULL,
    sks integer NOT NULL
);


ALTER TABLE public.class_schedules OWNER TO facelock;

--
-- Name: class_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: facelock
--

CREATE SEQUENCE public.class_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.class_schedules_id_seq OWNER TO facelock;

--
-- Name: class_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: facelock
--

ALTER SEQUENCE public.class_schedules_id_seq OWNED BY public.class_schedules.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: facelock
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    face_embedding public.vector(128),
    role character varying(20) DEFAULT 'mahasiswa'::character varying,
    nim character varying(30),
    kelas character varying(30),
    prodi character varying(100),
    jurusan character varying(100),
    image_path character varying(255)
);


ALTER TABLE public.users OWNER TO facelock;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: facelock
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO facelock;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: facelock
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: access_logs id; Type: DEFAULT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.access_logs ALTER COLUMN id SET DEFAULT nextval('public.access_logs_id_seq'::regclass);


--
-- Name: class_schedules id; Type: DEFAULT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.class_schedules ALTER COLUMN id SET DEFAULT nextval('public.class_schedules_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: access_logs; Type: TABLE DATA; Schema: public; Owner: facelock
--

COPY public.access_logs (id, user_id, status, "timestamp", confidence_score, reason, image_path, room, user_name, user_role, user_nim, user_kelas) FROM stdin;
2	\N	no_face	2026-10-29 12:09:11.130122+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261029_190910_8cd188cd.jpg	GSG210	\N	\N	\N	\N
3	\N	no_face	2026-10-29 12:09:49.105355+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261029_190948_ba61860e.jpg	GSG210	\N	\N	\N	\N
4	\N	no_face	2026-10-29 12:11:21.317455+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261029_191120_6b9b4448.jpg	GSG210	\N	\N	\N	\N
5	6	out_of_schedule	2026-10-29 12:12:35.246205+00	0.6356	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Kamis, 19:12 WIB).	capture_20261029_191232_fd82fef7.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
6	\N	no_face	2026-10-29 12:13:58.811636+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261029_191358_7e9cfdd0.jpg	GSG210	\N	\N	\N	\N
7	\N	no_face	2026-10-29 12:14:11.37415+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261029_191411_df39ab7b.jpg	GSG210	\N	\N	\N	\N
8	6	success	2026-10-29 12:17:04.577436+00	0.572	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261029_191701_45de0811.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
9	\N	unregistered	2026-10-29 12:18:31.37675+00	0.504	Akses ditolak: Wajah terdeteksi namun belum terdaftar di sistem Smart Classroom.	capture_20261029_191828_766ffe93.jpg	GSG210	Tidak Terdaftar	unknown	\N	\N
10	6	success	2026-10-29 12:19:04.704165+00	0.5595	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261029_191902_5d9afbcf.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
11	6	success	2026-10-29 12:33:11.621085+00	0.5447	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261029_193309_e3bbc4d6.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
12	\N	no_face	2026-10-29 12:34:24.556518+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261029_193424_b77e3d0e.jpg	GSG210	\N	\N	\N	\N
13	6	out_of_schedule	2026-10-30 02:47:49.341+00	0.522	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Jumat, 09:47 WIB).	capture_20261030_094747_5e336c3f.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
14	6	out_of_schedule	2026-10-30 02:48:04.044629+00	0.524	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Jumat, 09:48 WIB).	capture_20261030_094802_c73d4de7.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
15	6	success	2026-10-30 02:48:48.269804+00	0.5646	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_094846_4e78957d.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
16	6	success	2026-10-30 02:50:31.994891+00	0.5839	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_095030_ed580332.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
17	\N	unregistered	2026-10-30 02:50:51.45837+00	0.5093	Akses ditolak: Wajah terdeteksi namun belum terdaftar di sistem Smart Classroom.	capture_20261030_095050_c30e29d6.jpg	GSG210	Tidak Terdaftar	unknown	\N	\N
18	6	out_of_schedule	2026-10-30 02:52:24.94918+00	0.6853	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Jumat, 09:52 WIB).	capture_20261030_095221_3e49c685.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
19	6	success	2026-10-30 02:53:11.824201+00	0.6419	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_095309_8b812354.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
20	6	success	2026-10-30 02:54:43.877081+00	0.5264	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_095442_9b5945ee.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
21	\N	no_face	2026-10-30 04:03:00.43454+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_110300_c071ba43.jpg	GSG210	\N	\N	\N	\N
22	\N	no_face	2026-10-30 04:03:10.847691+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_110310_505b14bf.jpg	GSG210	\N	\N	\N	\N
23	6	out_of_schedule	2026-10-30 04:03:41.590305+00	0.5808	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Jumat, 11:03 WIB).	capture_20261030_110340_945180c8.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
24	\N	no_face	2026-10-30 04:03:52.888216+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_110352_e2517f57.jpg	GSG210	\N	\N	\N	\N
25	\N	unregistered	2026-10-30 04:04:04.401072+00	0.4722	Akses ditolak: Wajah terdeteksi namun belum terdaftar di sistem Smart Classroom.	capture_20261030_110403_f42e4c2e.jpg	GSG210	Tidak Terdaftar	unknown	\N	\N
26	6	success	2026-10-30 04:04:24.577613+00	0.5581	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_110423_1496ae2e.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
27	\N	no_face	2026-10-30 04:15:11.424737+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_111511_a27339e1.jpg	GSG210	\N	\N	\N	\N
28	\N	no_face	2026-10-30 04:15:26.301878+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_111526_3f92f656.jpg	GSG210	\N	\N	\N	\N
29	\N	no_face	2026-10-30 04:15:39.644718+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_111539_769760b8.jpg	GSG210	\N	\N	\N	\N
30	\N	no_face	2026-10-30 04:16:01.85227+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_111601_7d033929.jpg	GSG210	\N	\N	\N	\N
31	\N	no_face	2026-10-30 04:16:19.211735+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_111619_a470eff8.jpg	GSG210	\N	\N	\N	\N
32	6	success	2026-10-30 04:16:29.056583+00	0.5752	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_111627_051291cf.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
33	\N	no_face	2026-10-30 06:36:38.791874+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_133637_f5c30033.jpg	GSG210	\N	\N	\N	\N
34	\N	no_face	2026-10-30 06:40:31.11758+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_134030_665a0695.jpg	GSG210	\N	\N	\N	\N
35	\N	no_face	2026-10-30 07:13:01.470194+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261030_141300_4dcd043f.jpg	GSG210	\N	\N	\N	\N
36	6	out_of_schedule	2026-10-30 07:13:50.761357+00	0.5678	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Jumat, 14:13 WIB).	capture_20261030_141348_0baece45.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
37	6	success	2026-10-30 07:15:36.999145+00	0.5412	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261030_141536_54121941.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
38	\N	no_face	2026-11-03 03:46:17.466207+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_104615_e6429c71.jpg	GSG210	\N	\N	\N	\N
39	6	out_of_schedule	2026-11-03 03:47:16.753409+00	0.5684	Akses ditolak: Tidak ada jadwal kuliah kelas TMJ 5C saat ini (Selasa, 10:47 WIB).	capture_20261103_104709_4e0f2f53.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
40	\N	no_face	2026-11-03 05:09:43.108252+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_120942_5aa3d2db.jpg	GSG210	\N	\N	\N	\N
41	6	success	2026-11-03 05:10:28.971763+00	0.5577	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261103_121026_a81efb1c.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
42	\N	no_face	2026-11-03 07:57:13.8436+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_145713_a4671a40.jpg	GSG210	\N	\N	\N	\N
43	\N	no_face	2026-11-03 08:02:21.047033+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_150219_98410e03.jpg	GSG210	\N	\N	\N	\N
44	\N	no_face	2026-11-03 08:02:44.840312+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_150244_9a9e4e1e.jpg	GSG210	\N	\N	\N	\N
45	6	success	2026-11-03 08:03:06.785127+00	0.5835	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261103_150303_f0b78c5d.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
46	\N	no_face	2026-11-03 08:04:48.610408+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_150448_fa9267d6.jpg	GSG210	\N	\N	\N	\N
47	6	success	2026-11-03 08:05:04.353839+00	0.5643	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261103_150502_3f4166af.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
48	\N	no_face	2026-11-03 08:11:23.604084+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_151123_0a24ce97.jpg	GSG210	\N	\N	\N	\N
49	6	success	2026-11-03 08:11:37.815375+00	0.573	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261103_151134_7f651e2c.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
50	6	success	2026-11-03 08:12:33.959154+00	0.5257	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261103_151231_6fce04aa.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
51	\N	no_face	2026-11-03 08:19:05.211231+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261103_151904_9e23b1dd.jpg	GSG210	\N	\N	\N	\N
52	\N	no_face	2026-11-04 03:06:00.979202+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_100559_7ed6452d.jpg	GSG210	\N	\N	\N	\N
53	\N	no_face	2026-11-04 03:06:20.222268+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_100619_9f72a0b6.jpg	GSG210	\N	\N	\N	\N
54	\N	no_face	2026-11-04 03:06:57.748146+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_100656_b81a8fd6.jpg	GSG210	\N	\N	\N	\N
55	\N	no_face	2026-11-04 03:09:03.596027+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_100902_a9a1fb02.jpg	GSG210	\N	\N	\N	\N
56	\N	no_face	2026-11-04 03:09:55.304152+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_100954_65607718.jpg	GSG210	\N	\N	\N	\N
57	\N	no_face	2026-11-04 03:14:50.437309+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_101449_a87bfa1c.jpg	GSG210	\N	\N	\N	\N
58	\N	no_face	2026-11-04 03:22:22.464524+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_102221_0cddab2f.jpg	GSG210	\N	\N	\N	\N
59	\N	no_face	2026-11-04 03:25:15.040235+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_102513_bc123c05.jpg	GSG210	\N	\N	\N	\N
60	\N	no_face	2026-11-04 03:29:06.340402+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_102905_cbb1ec25.jpg	GSG210	\N	\N	\N	\N
61	\N	no_face	2026-11-04 03:32:11.578657+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_103210_666c3e44.jpg	GSG210	\N	\N	\N	\N
62	\N	no_face	2026-11-04 03:39:01.025837+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_103859_916323d7.jpg	GSG210	\N	\N	\N	\N
63	\N	no_face	2026-11-04 03:40:04.137393+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_104003_0eb77b55.jpg	GSG210	\N	\N	\N	\N
64	\N	no_face	2026-11-04 03:43:12.305126+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_104311_d372e180.jpg	GSG210	\N	\N	\N	\N
65	\N	no_face	2026-11-04 03:43:20.391673+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_104319_6af471ca.jpg	GSG210	\N	\N	\N	\N
66	\N	no_face	2026-11-04 03:43:44.300405+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_104343_9ba487ab.jpg	GSG210	\N	\N	\N	\N
67	\N	no_face	2026-11-04 03:44:22.253055+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_104421_8e0e29fd.jpg	GSG210	\N	\N	\N	\N
68	6	success	2026-11-04 03:44:45.473254+00	0.5407	Akses diberikan: Raffi Rabbani Widyputra (Kelas TMJ 5C) | Matkul: Analisis Permintaan Jaringan (07:30-13:20 WIB di GSG210).	capture_20261104_104442_7dac4438.jpg	GSG210	Raffi Rabbani Widyputra	mahasiswa	240723230293	TMJ 5C
69	\N	no_face	2026-11-04 04:29:42.307898+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_112941_10478390.jpg	GSG210	\N	\N	\N	\N
70	\N	no_face	2026-11-04 04:29:55.268055+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_112954_f5332cbf.jpg	GSG210	\N	\N	\N	\N
71	\N	no_face	2026-11-04 04:30:03.154952+00	\N	Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi.	capture_20261104_113002_a4cbe20c.jpg	GSG210	\N	\N	\N	\N
\.


--
-- Data for Name: class_schedules; Type: TABLE DATA; Schema: public; Owner: facelock
--

COPY public.class_schedules (id, kelas, day, slot, start_time, end_time, subject, lecturer, room, sks) FROM stdin;
15	TI 1B	Senin	7 - 12	13:20	18:55	Sistem Operasi	Dr. Defiana	GSG210	3
22	TI 3A	Selasa	1 - 4	07:30	10:50	Kecerdasan Buatan	Dr. Dewi	GSG210	2
27	TI 3B	Senin	7 - 10	13:20	16:55	Manajemen Proyek TIK	Abdul Hadi	GSG211	2
30	TI 3B	Rabu	1 - 4	07:30	10:50	Pemrograman Visual	Chairul Fikri	GSG211	2
35	TI 3C	Senin	1 - 4	07:30	10:50	Desain UI/UX	Iwan Sonjaya	GSG210	2
38	TI 3C	Kamis	7 - 11	13:20	17:45	Grafika Komputer	Anggi Mardiyono	GSG211	2
39	TI 3C	Jumat	1 - 4	07:30	10:50	Metode Numerik	Fajar Septian	GSG211	2
42	TMD 1A	Rabu	7 - 12	13:20	18:55	Menggambar	Ibnu Mulyana	GSG210	3
46	TMD 1B	Senin	1 - 6	07:30	13:20	Menggambar	Yulianto Hadiprawiro	GSG211	3
65	TMD 3A	Kamis	1 - 4	07:30	10:50	Grafika Komputer	Sinantya Feranti	GSG210	2
71	TMD 3B	Selasa	1 - 4	07:30	10:50	Kewarganegaraan	Dinda Kadarwati	GSG211	2
72	TMD 3B	Selasa	7 - 10	13:20	16:55	Bahasa Indonesia	Rahmatia Ayu	GSG211	2
75	TMD 3B	Jumat	1 - 4	07:30	10:50	Grafika Komputer	Mahbubul Wathoni	GSG210	2
83	TMD 3C	Jumat	6 - 9	13:20	16:55	Grafika Komputer	Mahbubul Wathoni	GSG210	2
89	TMJ-CCIT 1A	Selasa	5 - 8	10:50	15:00	Algoritma dan Pemrograman	Ariawan Andi	GSG210	2
95	TMJ 5C	Rabu	1 - 6	07:30	13:20	Analisis Permintaan Jaringan	Dr. Defiana	GSG210	3
96	TMJ 5C	Rabu	7 - 12	13:20	18:55	Komunikasi Profesional	Dr. Indra	GSG211	3
97	TMJ 5C	Kamis	1 - 6	07:30	13:20	Dokumentasi Jaringan	Dwi Ermawati / Chandra Wirawan	GSG211	3
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: facelock
--

COPY public.users (id, name, created_at, face_embedding, role, nim, kelas, prodi, jurusan, image_path) FROM stdin;
2	Muhammad Iqbal Syarif	2026-10-29 09:42:42.283363+00	\N	admin	2407421059	Super Admin	Teknik Multimedia dan Jaringan	Teknik Informatika dan Komputer	\N
3	Muhammad Iqbal Haysami	2026-10-29 09:42:42.283363+00	\N	admin	2407421069	Network Admin	Teknik Multimedia dan Jaringan	Teknik Informatika dan Komputer	\N
4	Raffi Rabbani Widyputra	2026-10-29 09:42:42.283363+00	\N	admin	2407421077	System Admin	Teknik Multimedia dan Jaringan	Teknik Informatika dan Komputer	\N
5	Muhammad Imam Syuhada	2026-10-29 09:42:42.283363+00	\N	admin	2407421081	Security Admin	Teknik Multimedia dan Jaringan	Teknik Informatika dan Komputer	\N
7	Abdul Hadi	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TI 3B)	\N	\N	\N
8	Anggi Mardiyono	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TI 3C)	\N	\N	\N
9	Ariawan Andi	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TMJ-CCIT 1A)	\N	\N	\N
10	Chairul Fikri	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TI 3B)	\N	\N	\N
11	Dinda Kadarwati	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TMD 3B)	\N	\N	\N
12	Dr. Defiana	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TI 1B, TMJ 5C)	\N	\N	\N
13	Dr. Dewi	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TI 3A)	\N	\N	\N
14	Dr. Indra	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TMJ 5C)	\N	\N	\N
15	Dwi Ermawati / Chandra Wirawan	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TMJ 5C)	\N	\N	\N
16	Fajar Septian	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TI 3C)	\N	\N	\N
17	Ibnu Mulyana	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TMD 1A)	\N	\N	\N
18	Iwan Sonjaya	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TI 3C)	\N	\N	\N
19	Mahbubul Wathoni	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TMD 3B, TMD 3C)	\N	\N	\N
20	Rahmatia Ayu	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TMD 3B)	\N	\N	\N
21	Sinantya Feranti	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG210 (TMD 3A)	\N	\N	\N
22	Yulianto Hadiprawiro	2026-10-29 10:35:32.429396+00	\N	dosen	\N	GSG211 (TMD 1B)	\N	\N	\N
6	Raffi Rabbani Widyputra	2026-10-29 09:46:07.862578+00	[-0.107458994,0.11287448,-0.026945077,-0.024179403,-0.06508291,-0.062239997,-0.025965733,-0.13233988,0.13209862,-0.07756552,0.25662112,-0.14118284,-0.17998354,-0.12622692,-0.060933053,0.16256581,-0.15467875,-0.070603326,-0.034012213,-0.022815727,0.10043515,-0.001162791,-0.007250514,0.064438365,-0.07875051,-0.38972867,-0.099445045,-0.09936347,0.011454104,-0.061537646,-0.046866797,0.044588685,-0.16919748,-0.11848238,0.044027083,0.047802728,-0.04717125,-0.013403563,0.18121694,-0.0030456153,-0.18847452,0.004143135,0.09702131,0.28233802,0.17581803,0.068346195,0.021352632,-0.17455074,0.14024587,-0.09133875,0.0010382695,0.13861746,0.088430725,0.09976464,-0.008877844,-0.07430143,0.032158338,0.08168411,-0.16510391,0.0010786375,0.12315615,-0.08853485,-0.042752884,-0.07217095,0.24916391,0.024365097,-0.12265363,-0.17550622,0.114520304,-0.16180497,-0.08275666,0.041351475,-0.12959415,-0.18109855,-0.35797143,0.047510356,0.3826353,0.11935687,-0.14082703,0.031526856,-0.07582785,-0.02308127,0.14234704,0.16174763,-0.021647416,0.009244766,-0.06059979,0.002075987,0.18731904,-0.05874773,-0.042191163,0.17694256,-0.027571676,0.09718004,0.004451363,0.04990345,-0.14451991,0.054361723,-0.095474616,-0.0071690246,0.044842493,-0.036642555,0.04878868,0.12949382,-0.16462706,0.159605,-0.0077952025,0.05173562,0.023138326,-0.003399232,-0.07649173,-0.06260458,0.0889564,-0.21739626,0.1890628,0.13668965,0.10599297,0.12664616,0.12478282,0.0708995,-0.02753681,-0.0045289383,-0.21611182,-0.008680092,0.082331,0.008956116,0.09599226,-0.027431762]	mahasiswa	240723230293	TMJ 5C	Teknik Multimedia dan Jaringan	Teknik Informatika dan Komputer	capture_20261029_173825_a4528d86.jpg
\.


--
-- Name: access_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: facelock
--

SELECT pg_catalog.setval('public.access_logs_id_seq', 71, true);


--
-- Name: class_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: facelock
--

SELECT pg_catalog.setval('public.class_schedules_id_seq', 105, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: facelock
--

SELECT pg_catalog.setval('public.users_id_seq', 22, true);


--
-- Name: access_logs access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (id);


--
-- Name: class_schedules class_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_access_logs_status; Type: INDEX; Schema: public; Owner: facelock
--

CREATE INDEX ix_access_logs_status ON public.access_logs USING btree (status);


--
-- Name: ix_access_logs_timestamp; Type: INDEX; Schema: public; Owner: facelock
--

CREATE INDEX ix_access_logs_timestamp ON public.access_logs USING btree ("timestamp" DESC);


--
-- Name: ix_access_logs_user_id; Type: INDEX; Schema: public; Owner: facelock
--

CREATE INDEX ix_access_logs_user_id ON public.access_logs USING btree (user_id);


--
-- Name: ix_class_schedules_day; Type: INDEX; Schema: public; Owner: facelock
--

CREATE INDEX ix_class_schedules_day ON public.class_schedules USING btree (day);


--
-- Name: ix_class_schedules_kelas; Type: INDEX; Schema: public; Owner: facelock
--

CREATE INDEX ix_class_schedules_kelas ON public.class_schedules USING btree (kelas);


--
-- Name: access_logs access_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: facelock
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict hUlhYUXoLyMJqeN1LlFDTUwEuW5mEOr5B1zLo0SbSz4pIqVCgyF4nNLrPdzvizs

