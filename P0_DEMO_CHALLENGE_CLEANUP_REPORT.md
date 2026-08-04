# P0 Demo Challenge Cleanup Report

## Verdict

PASS

The local/demo challenge data was cleaned so the active Supabase-backed application persistence contains only the retained challenge.

Retained draft ID:

`7897dca3-8299-4770-a013-e2595b92f5fe`

Retained challenge ID:

`0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4`

## Persistence Sources Inspected

- Supabase lifecycle tables via `.env.local` service role: `ccn_challenge_drafts`, `ccn_challenge_funding_records`, `ccn_wallet_approval_attempts`, `ccn_funding_attempts`, `ccn_creator_submissions`, `ccn_submission_finalize_keys`, `ccn_review_scores`, `ccn_winner_finalization_attempts`, `ccn_onchain_verifications`, `ccn_public_slug_reservations`, `ccn_lifecycle_events`.
- Local filesystem stores: `.local/create-challenge-flow.json`, `.local/internal-submissions-spike.json`, `.local/manual-creator-ux-01-1.json`.
- Runtime source paths: create-challenge store, submission store, published challenge source, static public challenge mocks, challenge wizard session storage, Brand notification localStorage.
- Seed and fixture scripts: `seed-checkpoint3-lifecycle-fixture.mjs`, `seed-checkpoint3-workspace-demo.mjs`, `checkpoint3-canonical-fixture.mjs`, and validation scripts that create isolated temporary rows.

## Challenge IDs Found Before Cleanup

Supabase draft IDs found before cleanup: 83

- 5d586588-589e-4f23-835a-c137f5e08ea7
- 0ff95965-a193-40b2-a333-bc089cad27a4
- 776fa7bb-8e3b-46fd-ae75-124d0b24f5f0
- adf163c0-c137-4c39-a685-cea67a7be051
- 7897dca3-8299-4770-a013-e2595b92f5fe
- 1062148f-fe4e-4cc1-9a0c-ebcb792b727b
- 675b2d04-c2c4-4477-86d0-41faba8b91cc
- 8f3ca4da-ef42-4f16-b37b-4e7ac5d52212
- 2ae5387b-cb10-41f1-8803-5c97091d80f6
- 43f85313-7297-4f08-b21d-414a775e07c9
- 9b8dc105-1ec1-416f-a9c8-980da1025d52
- f7dab68b-270b-4442-a6e8-b8dd89e76c90
- 461e7c3d-bb7e-45cc-9b9b-f27e174973bd
- 992208cf-aaf2-4677-82a0-f5c0a3f54d10
- d6b4dd2f-54e1-4065-9901-3a5b07962313
- dc0800f6-3614-4f4b-895a-19ab4e652b80
- 4a883ac8-593e-401b-bd40-4d5bfd67751c
- 0d94534e-c51c-4d54-8d69-61a6d818ba12
- f055b41e-d660-4dad-b67e-c5c4dd60a318
- 6e21d062-1dd2-4c12-b0bb-de4d08560ab5
- 74dccccc-cb29-4ea8-a57d-7c765da56233
- 86f33f2f-b2df-47fe-96c2-84470e6bffbd
- c4c25bf1-719c-4f5a-812b-da0ee0e2dce8
- 78d0b490-86ce-40ba-9749-382b587f8092
- 4bf36c3e-22bb-4837-b342-4eb0b84ae605
- 9a98bde5-f3b0-46eb-8137-47580a0d09c3
- 7a87525a-376e-4234-b9b0-71f2557f9dc6
- 78cee0e7-ae7a-4e7b-8509-a3bd40a9ca65
- b0e49720-96d3-4951-882d-3b70e63c057a
- 3df7d176-5db1-4fc6-a2c8-6bd6ef691619
- 27975633-ccc0-4fa4-bcd7-71aa8d26ac73
- dbc0f8b4-4c59-44e7-983f-ef02500e8b77
- d8a55769-c8f0-463f-895e-e73527fa714a
- 15d4c832-e2d7-423c-a060-f2234ff99566
- ac804aae-6a9c-48ab-a44b-3408db8d41de
- f1f842e9-8317-476c-88e2-50767e468e5e
- 9e7b028a-55f1-459c-84dd-7c5c77d2a75c
- f6c8083d-4e46-4bb7-8d0c-1ec61385e67a
- 6ae7be6a-df1f-4c62-abe1-b1eb10db6bdc
- 80f6ba61-d2e6-45a7-9429-c6c489f1ae6b
- 7ef88a1b-65a1-4d99-8b53-30fdc7c64797
- a8c312c7-f078-478c-8e66-70efc343848b
- 791d9ab9-2a7b-4919-b97d-6199adb82838
- 2dc7414a-340e-43bb-a731-9633bb173246
- 65a40ae9-b72e-4851-8a3f-1c8d44bdfd9d
- 3a50c97a-0036-4b0f-9e7a-7c555a0bd247
- ca842c37-33be-4a00-b1d4-52afcd5712bd
- aacbd490-ad57-4e1a-899b-8430f108a770
- 0481280b-fe66-462d-b8e4-2fe55df7d2a1
- a1970183-3adf-4b6e-91c5-ee9014917909
- cfc82e65-7728-4ff5-bbff-77c3c18cfb91
- 0586f339-16d4-46b2-87cd-1b3c8e5dda23
- 35e3c0fe-3627-49e3-9a0d-fccfdfab18d7
- 43730332-19af-4b4a-b2fe-690d29a2cc55
- d77f692c-7907-4b19-abe3-4faa0b65290b
- 091d87a8-79e2-4f2f-986d-3795378f4cc1
- 26ab9049-c313-4bf1-a4dc-d39ebcc52897
- 427ad322-13d7-40f9-a2df-426f89e33ad2
- e5fa301a-cbbb-4e01-b975-c19babe5c9f9
- d1d727b9-0743-4fc2-a5b4-87d7fe2a36ed
- 8c4588ae-214f-4418-b0db-753d02799f3d
- c3087d79-4896-41eb-b33c-35d21ce2fee5
- 64096381-05dc-43d9-846b-33105cda8543
- b16f2143-6f1e-41ae-82ff-a7fe78f45699
- e34d7cbc-7ebe-4b52-a3d5-5b872ff7b7aa
- checkpoint3-lifecycle-fixture
- f85358a6-6ccd-4c47-8e24-820cc1d918d3
- e67170f0-eba9-4cdd-8ad1-6720465dec6e
- 62026a60-9796-4412-a5af-01d50142cf27
- 92edc9ae-c5cb-4612-bd9f-006c2360bf6e
- c58cc129-b87b-4a8a-8935-b3a42f3f1f39
- accc4521-2741-440b-b107-6ed1e3935986
- c4d46108-36e4-4821-8c0f-e06dee4418bc
- 3f689d9e-e757-40c8-9e30-f1d846ffa7a4
- ceeade72-14be-40bf-b064-14ba3a30c883
- 73433fb9-6763-484c-9bfc-6981856f168f
- 33e3a135-ac94-4582-93a8-5164815df75e
- 9f856bb0-1186-4057-a1e7-c37cb7bcf648
- d89ffdc9-6b7a-48cf-b872-ed9366aa4d48
- 4864e9a8-1c72-4c3a-a7fb-f1580e53d48e
- 86d680b6-e9ee-45d4-a9ba-9bf35a00935f
- 35a2d464-d342-43b8-961f-e394a6babaa0
- 6702a744-fe58-472c-b6ed-bcb925b7229f

Supabase challenge IDs found before cleanup: 83

- 0x97fa41e3ac123352ccd3263ee0ebaf6133c876b266d6eb20e292ee5d311964b6
- 0xd8f17dea6ebdd8411372a8f7337f20e18e9d067454880feb0650068419649bec
- 0x60eadd7a277a3e8c2a7cb460c21a8253092740214944a012e336ad2f0c95eff4
- 0xcee72b0d91ca390d0caf6a4a62acb163093d381470e09c8142ba1af65557c7ba
- 0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4
- 0x3289bef91766dd9b9db06508bbc7ec064b66cd0e73192fe5acf59b35fd470769
- 0x653dc142bdb0b916c2fd9d8bcc1820b6f1b42395b6e6f49e2f3cb331e2ba3f13
- 0x641b9773e382634652d0933ec419919f265241fcebdbb8bae59440f69e2d0228
- 0xde113b5e8f52aca3ea290e9fcb59d92f5661f293300b71267683449db15d7aec
- 0x4aec4b40caef2dc51a1ac386206caf577bd3544db76290dab508d9fcbaf02309
- 0xb453460536e431e5ba3fdf93a5a71f9ead57f1e31db849fab7a3102f4a8f5eaf
- 0x2ab332a2118f2e490774bc0a4bb1d283c4bc98c03b562d7365a75af66d4200ae
- 0xd8c027d22d0874de3c77c960418fe5ffaa4c42caea8d03820ef3c1f80dde39eb
- 0x23a0cea3bd69c53c2161ca065ca589a8f65525e3e516b39555dedec8f673c89a
- 0x5554999cbfeee58f89bc5eb681d7cf75fb2999c60acee905220f47311f2e0907
- 0xdeed9e5f02d3cf8b1113e2b76afe1f2ef36eeeea4b4cfa35849b526cfd2f4cd5
- 0xec671f5d0c2df11d9a40f34bed166619f9e1ff49f0077642eb97780449342ff9
- 0xb5d6ee691de1f35bc676911db0925b140bbba7dc6c1e2c85999844435a1635d9
- 0x0535fd52725dd4daef5277697e3eda88c0d09fd5a740ca3403d41fa13468c300
- 0xb3c960a19277e6af604e36003e8d8c7d5f9ae83cd7f86b415cbad288c3fefccc
- 0x06e9f6013e9be9683b77f3529612552831840f46ee77f72f9feac8a45c857674
- 0xf1f11e4b65f4cbacad46dd04aba27e72ec20b41ca852e4617dc5401671ce821c
- 0xe672d82f3025d3b7933f3216d6d24b48e6e9337f08764a9e3d727e616cdef1a6
- 0xfa0f8e16af4882c26e28cf3b8efcbed806da430920f49b2407ae563880e56a63
- 0x3b45b5df4d0f8323d71a6425080ad204a194cfde22d907a34bac273c87fd316b
- 0x10c1b5ea3dc46fdc153dd8e922be04193c8084d0167c88e559e3e61d49817d0c
- 0x84637f8ec02f49e726032b55712c7b91ff4d4c2cb750e9b16ce33b41708aa7ab
- 0x84fda9deee54ad873594d23bee4c95e35d8d9754c8a7770bded6550e8344f53a
- 0x244df1920431ab423edc0774e1ac6acb4c195d1fbc045770ed9eb5d6f9abb253
- 0x5d8bf8ca2b58ccb17155d277bbf01a0a96ec8a1bdf8514c38338b9cb21b4502f
- 0xd1a21d2b0588134f309e6c8bcc7df3cf2736047f97eabad37c036f568d26e063
- 0x74ed3802a45854afc1edd24e54eb3f850246199b0b52e5079351dbc7734838da
- 0xab7bc05165dcb96c32f47b6f83e1372552076fe5874ddb555af9ec8ebb7b3540
- 0x8797b36b61a3ac77b75553664afbda4da0fa048d123f3a6235024e95f22a29eb
- 0x0fbac9c49070f48ba87a3d861505fcad71f92e10cfdef83ff4dc98640a732308
- 0x3647f1ad87db456b7412b54bd42e8103b22287ecb0bfa4e9267d0d067957de1f
- 0xb295c843524fb110fde5b8cbaf6616ebd48996f0f94b1c2fb782fe4dfb790619
- 0x570b671c56e418dd4e778609a9e99c063c9e0e1125689c21eb301b4ce9ccfbc9
- 0xf29bacf6ae81b2e01ed53e088ae915ac17036578fbe755a3394e3c0489c9eb78
- 0x37aba3b7a539565e9cbd4ef5d58760a7c9e6a3757988a36b6f734d5c3b5c9a35
- 0x8bcdd2a06a3efc3ecde8702769f07098afbecae15a53af9562e8aca739d43190
- 0xb6c4a929742a36a0006451dc34c0728b9ed7c7e31d5aa20903bc2703ae4e63fb
- 0xceb7f1390877f1de72ceda96976eb2c93e3415bdf661f345bd20984c9b4da3b9
- 0x8bf2fef167e6015664f3f0f1bbd0aea2e19855142c6f925eb3295f8d07afe177
- 0xf166dbc745d9994955dd31d078e194d25cbb4b5c2ac31a3ebd6cdeb3a007dd37
- 0xa85332fd5351fa7e3d00d3af45610bf994eb4d7529ad3c97ce2797ef44fd2391
- 0x75d7e2efadf20245f5654fad5e871e3303390520b3252900d585c61f6d89cbc1
- 0x5c5937a3108cc14e21344fd1aafed8c045a0c8023be37da7c03eaea0fe971aff
- 0xecfe29df65d5245fdca404951072cd45a165139df12a3d37e3390b64ea6c753b
- 0xe64d625990fe015863959858c8098fde25ddf339dd910ed51edd51fa2365e94e
- 0x66994c28af53cc3d5e34e101e7efbf5031a7ebf16280b3a9f7044a4e729eec0f
- 0x5f15fe1ea2f3ac2aabad5594dcf061fc13c1851ee931737752107c4e7177e316
- 0x5f00668143bdf1bf33db7e4f0406d018a9710aec130aa4ec19784a5fcc9bf1ff
- 0xe1a5fb4eb7b05d7e0dda84825f76ee2a412e3dabe968db7a2aa19271028e53e9
- 0xf4b862ba36bd4f2c1ec198702a7915fe8eb0877c44ebb66193352fb14e6e2ac1
- 0x664ba12442cff9240783996a32b7bda257e24e2de0a427b8dbc1c95fb9ad0784
- 0xa19cb1228481df0f31f7761660ea6e7ee193f8c3e33608845f2bd65fd798a6a4
- 0x618e969fa10212263c4956cee9999da4d5b577b17404aec7472cf6905ee6b15b
- 0xc99910cd98e029e69f947a950a70802d4cd960ece498ecfc17f6f903682f9247
- 0x755d0bbae503fc3e5500b73f5cd7cf2a5b838c231eb6260c7219d1ebc657d2f1
- 0xe246db0106210474d29865191bab503a98398c28dfb4f722b81978a0b6012169
- 0x142576c9fd815ac0e243cd9ab95e7b609eeec58687cf89f51796a4c2c42f68a0
- 0x503bb85265028bedc453374b6df0edf97c8ad77a662642f7e5dca53c26b5bd43
- 0xd9b63f4fc2a8d226d158f2995b2d044d77a5066cdf129633bb898eddc9d1c03c
- 0x22e5c56589fc745a643035286b84d45d01d5ee4db24efd1e97e9c3b53b8036d3
- 0x6700e1537f881d48607b595e24cdf7443de85ef33a18f803b83a09ff11975d26
- 0x9a309b6e3d4a00486994cc9c05d9a1950ba2ea44757288f84ab86c574f283888
- 0x3adfe2cfa03c328503e52db7e55df36825c182fddbe877b32f2a3d35c031b268
- 0x9c8627879fb8cfe00ca8cc68125f8ba32f808950f3b2ba1ce467b8a79480e185
- 0x78f2e9f62ee016380c109a4f3d249145a1c0a58ab5c5df56ea071103885e50a9
- 0x3bfc21b157f623363dd3bf5622d0cc69c5e7ff7af2a654459349aa00bd363040
- 0xc403fb0fff8535d27424171dc2dd074e4e40fdd3a227f94954e9f1115a289c2c
- 0x1c90a8863a45674010e4f5153dcc0d3fd2808ca42bd17c8dfca1aef29dcc6aa0
- 0x7771814edeb7af35e32cf3aa77bf61a37d53488d536e97cd1930a0134e310be3
- 0x149f6f1f72469e438147da5e21917e992854b3b086918b04342a11178a924621
- 0x98ffd12658a495d8cfa0b2b386a43173d5f0ff0baff492bc3456181ec7fc6b0c
- 0x90a48ff46003d77ee085ec9804f99e8c50f9ac72ee9e01e851ce7237cdeafbe8
- 0x8ea5fb5953e042aee0d6574ec697ba0c88db5e988a4494fed6a07894cd46593a
- 0x098adb76843f4c771b9e999746c88fa74cf3b0780cd4d730da60624fde459097
- 0x8cb32382e59a922b429e1aec6a210b28857c00924fe335d806ccbff62dbad3cf
- 0xd42e2b27846b164764e62de9510824663d95ada3d62ce1f42fedb71a9f1adb5f
- 0xbb6ae93e7af5c54298c556053840795fc0f03791b424fddf996dbead49369b61
- 0xf0775f164fd73337c08ee40c6d4545a9ed53bccf4efb8d97c4a34f873392ecaa

Local `.local/create-challenge-flow.json` draft IDs found before cleanup: 20 in the first local pass. They did not include the retained draft ID, so the inactive local filesystem store was cleaned to empty instead of fabricating a retained copy.

## Removed Challenge IDs

Removed Supabase draft IDs: 82

- 5d586588-589e-4f23-835a-c137f5e08ea7
- 0ff95965-a193-40b2-a333-bc089cad27a4
- 776fa7bb-8e3b-46fd-ae75-124d0b24f5f0
- adf163c0-c137-4c39-a685-cea67a7be051
- 1062148f-fe4e-4cc1-9a0c-ebcb792b727b
- 675b2d04-c2c4-4477-86d0-41faba8b91cc
- 8f3ca4da-ef42-4f16-b37b-4e7ac5d52212
- 2ae5387b-cb10-41f1-8803-5c97091d80f6
- 43f85313-7297-4f08-b21d-414a775e07c9
- 9b8dc105-1ec1-416f-a9c8-980da1025d52
- f7dab68b-270b-4442-a6e8-b8dd89e76c90
- 461e7c3d-bb7e-45cc-9b9b-f27e174973bd
- 992208cf-aaf2-4677-82a0-f5c0a3f54d10
- d6b4dd2f-54e1-4065-9901-3a5b07962313
- dc0800f6-3614-4f4b-895a-19ab4e652b80
- 4a883ac8-593e-401b-bd40-4d5bfd67751c
- 0d94534e-c51c-4d54-8d69-61a6d818ba12
- f055b41e-d660-4dad-b67e-c5c4dd60a318
- 6e21d062-1dd2-4c12-b0bb-de4d08560ab5
- 74dccccc-cb29-4ea8-a57d-7c765da56233
- 86f33f2f-b2df-47fe-96c2-84470e6bffbd
- c4c25bf1-719c-4f5a-812b-da0ee0e2dce8
- 78d0b490-86ce-40ba-9749-382b587f8092
- 4bf36c3e-22bb-4837-b342-4eb0b84ae605
- 9a98bde5-f3b0-46eb-8137-47580a0d09c3
- 7a87525a-376e-4234-b9b0-71f2557f9dc6
- 78cee0e7-ae7a-4e7b-8509-a3bd40a9ca65
- b0e49720-96d3-4951-882d-3b70e63c057a
- 3df7d176-5db1-4fc6-a2c8-6bd6ef691619
- 27975633-ccc0-4fa4-bcd7-71aa8d26ac73
- dbc0f8b4-4c59-44e7-983f-ef02500e8b77
- d8a55769-c8f0-463f-895e-e73527fa714a
- 15d4c832-e2d7-423c-a060-f2234ff99566
- ac804aae-6a9c-48ab-a44b-3408db8d41de
- f1f842e9-8317-476c-88e2-50767e468e5e
- 9e7b028a-55f1-459c-84dd-7c5c77d2a75c
- f6c8083d-4e46-4bb7-8d0c-1ec61385e67a
- 6ae7be6a-df1f-4c62-abe1-b1eb10db6bdc
- 80f6ba61-d2e6-45a7-9429-c6c489f1ae6b
- 7ef88a1b-65a1-4d99-8b53-30fdc7c64797
- a8c312c7-f078-478c-8e66-70efc343848b
- 791d9ab9-2a7b-4919-b97d-6199adb82838
- 2dc7414a-340e-43bb-a731-9633bb173246
- 65a40ae9-b72e-4851-8a3f-1c8d44bdfd9d
- 3a50c97a-0036-4b0f-9e7a-7c555a0bd247
- ca842c37-33be-4a00-b1d4-52afcd5712bd
- aacbd490-ad57-4e1a-899b-8430f108a770
- 0481280b-fe66-462d-b8e4-2fe55df7d2a1
- a1970183-3adf-4b6e-91c5-ee9014917909
- cfc82e65-7728-4ff5-bbff-77c3c18cfb91
- 0586f339-16d4-46b2-87cd-1b3c8e5dda23
- 35e3c0fe-3627-49e3-9a0d-fccfdfab18d7
- 43730332-19af-4b4a-b2fe-690d29a2cc55
- d77f692c-7907-4b19-abe3-4faa0b65290b
- 091d87a8-79e2-4f2f-986d-3795378f4cc1
- 26ab9049-c313-4bf1-a4dc-d39ebcc52897
- 427ad322-13d7-40f9-a2df-426f89e33ad2
- e5fa301a-cbbb-4e01-b975-c19babe5c9f9
- d1d727b9-0743-4fc2-a5b4-87d7fe2a36ed
- 8c4588ae-214f-4418-b0db-753d02799f3d
- c3087d79-4896-41eb-b33c-35d21ce2fee5
- 64096381-05dc-43d9-846b-33105cda8543
- b16f2143-6f1e-41ae-82ff-a7fe78f45699
- e34d7cbc-7ebe-4b52-a3d5-5b872ff7b7aa
- checkpoint3-lifecycle-fixture
- f85358a6-6ccd-4c47-8e24-820cc1d918d3
- e67170f0-eba9-4cdd-8ad1-6720465dec6e
- 62026a60-9796-4412-a5af-01d50142cf27
- 92edc9ae-c5cb-4612-bd9f-006c2360bf6e
- c58cc129-b87b-4a8a-8935-b3a42f3f1f39
- accc4521-2741-440b-b107-6ed1e3935986
- c4d46108-36e4-4821-8c0f-e06dee4418bc
- 3f689d9e-e757-40c8-9e30-f1d846ffa7a4
- ceeade72-14be-40bf-b064-14ba3a30c883
- 73433fb9-6763-484c-9bfc-6981856f168f
- 33e3a135-ac94-4582-93a8-5164815df75e
- 9f856bb0-1186-4057-a1e7-c37cb7bcf648
- d89ffdc9-6b7a-48cf-b872-ed9366aa4d48
- 4864e9a8-1c72-4c3a-a7fb-f1580e53d48e
- 86d680b6-e9ee-45d4-a9ba-9bf35a00935f
- 35a2d464-d342-43b8-961f-e394a6babaa0
- 6702a744-fe58-472c-b6ed-bcb925b7229f

Removed Supabase challenge IDs: 82

- 0x97fa41e3ac123352ccd3263ee0ebaf6133c876b266d6eb20e292ee5d311964b6
- 0xd8f17dea6ebdd8411372a8f7337f20e18e9d067454880feb0650068419649bec
- 0x60eadd7a277a3e8c2a7cb460c21a8253092740214944a012e336ad2f0c95eff4
- 0xcee72b0d91ca390d0caf6a4a62acb163093d381470e09c8142ba1af65557c7ba
- 0x3289bef91766dd9b9db06508bbc7ec064b66cd0e73192fe5acf59b35fd470769
- 0x653dc142bdb0b916c2fd9d8bcc1820b6f1b42395b6e6f49e2f3cb331e2ba3f13
- 0x641b9773e382634652d0933ec419919f265241fcebdbb8bae59440f69e2d0228
- 0xde113b5e8f52aca3ea290e9fcb59d92f5661f293300b71267683449db15d7aec
- 0x4aec4b40caef2dc51a1ac386206caf577bd3544db76290dab508d9fcbaf02309
- 0xb453460536e431e5ba3fdf93a5a71f9ead57f1e31db849fab7a3102f4a8f5eaf
- 0x2ab332a2118f2e490774bc0a4bb1d283c4bc98c03b562d7365a75af66d4200ae
- 0xd8c027d22d0874de3c77c960418fe5ffaa4c42caea8d03820ef3c1f80dde39eb
- 0x23a0cea3bd69c53c2161ca065ca589a8f65525e3e516b39555dedec8f673c89a
- 0x5554999cbfeee58f89bc5eb681d7cf75fb2999c60acee905220f47311f2e0907
- 0xdeed9e5f02d3cf8b1113e2b76afe1f2ef36eeeea4b4cfa35849b526cfd2f4cd5
- 0xec671f5d0c2df11d9a40f34bed166619f9e1ff49f0077642eb97780449342ff9
- 0xb5d6ee691de1f35bc676911db0925b140bbba7dc6c1e2c85999844435a1635d9
- 0x0535fd52725dd4daef5277697e3eda88c0d09fd5a740ca3403d41fa13468c300
- 0xb3c960a19277e6af604e36003e8d8c7d5f9ae83cd7f86b415cbad288c3fefccc
- 0x06e9f6013e9be9683b77f3529612552831840f46ee77f72f9feac8a45c857674
- 0xf1f11e4b65f4cbacad46dd04aba27e72ec20b41ca852e4617dc5401671ce821c
- 0xe672d82f3025d3b7933f3216d6d24b48e6e9337f08764a9e3d727e616cdef1a6
- 0xfa0f8e16af4882c26e28cf3b8efcbed806da430920f49b2407ae563880e56a63
- 0x3b45b5df4d0f8323d71a6425080ad204a194cfde22d907a34bac273c87fd316b
- 0x10c1b5ea3dc46fdc153dd8e922be04193c8084d0167c88e559e3e61d49817d0c
- 0x84637f8ec02f49e726032b55712c7b91ff4d4c2cb750e9b16ce33b41708aa7ab
- 0x84fda9deee54ad873594d23bee4c95e35d8d9754c8a7770bded6550e8344f53a
- 0x244df1920431ab423edc0774e1ac6acb4c195d1fbc045770ed9eb5d6f9abb253
- 0x5d8bf8ca2b58ccb17155d277bbf01a0a96ec8a1bdf8514c38338b9cb21b4502f
- 0xd1a21d2b0588134f309e6c8bcc7df3cf2736047f97eabad37c036f568d26e063
- 0x74ed3802a45854afc1edd24e54eb3f850246199b0b52e5079351dbc7734838da
- 0xab7bc05165dcb96c32f47b6f83e1372552076fe5874ddb555af9ec8ebb7b3540
- 0x8797b36b61a3ac77b75553664afbda4da0fa048d123f3a6235024e95f22a29eb
- 0x0fbac9c49070f48ba87a3d861505fcad71f92e10cfdef83ff4dc98640a732308
- 0x3647f1ad87db456b7412b54bd42e8103b22287ecb0bfa4e9267d0d067957de1f
- 0xb295c843524fb110fde5b8cbaf6616ebd48996f0f94b1c2fb782fe4dfb790619
- 0x570b671c56e418dd4e778609a9e99c063c9e0e1125689c21eb301b4ce9ccfbc9
- 0xf29bacf6ae81b2e01ed53e088ae915ac17036578fbe755a3394e3c0489c9eb78
- 0x37aba3b7a539565e9cbd4ef5d58760a7c9e6a3757988a36b6f734d5c3b5c9a35
- 0x8bcdd2a06a3efc3ecde8702769f07098afbecae15a53af9562e8aca739d43190
- 0xb6c4a929742a36a0006451dc34c0728b9ed7c7e31d5aa20903bc2703ae4e63fb
- 0xceb7f1390877f1de72ceda96976eb2c93e3415bdf661f345bd20984c9b4da3b9
- 0x8bf2fef167e6015664f3f0f1bbd0aea2e19855142c6f925eb3295f8d07afe177
- 0xf166dbc745d9994955dd31d078e194d25cbb4b5c2ac31a3ebd6cdeb3a007dd37
- 0xa85332fd5351fa7e3d00d3af45610bf994eb4d7529ad3c97ce2797ef44fd2391
- 0x75d7e2efadf20245f5654fad5e871e3303390520b3252900d585c61f6d89cbc1
- 0x5c5937a3108cc14e21344fd1aafed8c045a0c8023be37da7c03eaea0fe971aff
- 0xecfe29df65d5245fdca404951072cd45a165139df12a3d37e3390b64ea6c753b
- 0xe64d625990fe015863959858c8098fde25ddf339dd910ed51edd51fa2365e94e
- 0x66994c28af53cc3d5e34e101e7efbf5031a7ebf16280b3a9f7044a4e729eec0f
- 0x5f15fe1ea2f3ac2aabad5594dcf061fc13c1851ee931737752107c4e7177e316
- 0x5f00668143bdf1bf33db7e4f0406d018a9710aec130aa4ec19784a5fcc9bf1ff
- 0xe1a5fb4eb7b05d7e0dda84825f76ee2a412e3dabe968db7a2aa19271028e53e9
- 0xf4b862ba36bd4f2c1ec198702a7915fe8eb0877c44ebb66193352fb14e6e2ac1
- 0x664ba12442cff9240783996a32b7bda257e24e2de0a427b8dbc1c95fb9ad0784
- 0xa19cb1228481df0f31f7761660ea6e7ee193f8c3e33608845f2bd65fd798a6a4
- 0x618e969fa10212263c4956cee9999da4d5b577b17404aec7472cf6905ee6b15b
- 0xc99910cd98e029e69f947a950a70802d4cd960ece498ecfc17f6f903682f9247
- 0x755d0bbae503fc3e5500b73f5cd7cf2a5b838c231eb6260c7219d1ebc657d2f1
- 0xe246db0106210474d29865191bab503a98398c28dfb4f722b81978a0b6012169
- 0x142576c9fd815ac0e243cd9ab95e7b609eeec58687cf89f51796a4c2c42f68a0
- 0x503bb85265028bedc453374b6df0edf97c8ad77a662642f7e5dca53c26b5bd43
- 0xd9b63f4fc2a8d226d158f2995b2d044d77a5066cdf129633bb898eddc9d1c03c
- 0x22e5c56589fc745a643035286b84d45d01d5ee4db24efd1e97e9c3b53b8036d3
- 0x6700e1537f881d48607b595e24cdf7443de85ef33a18f803b83a09ff11975d26
- 0x9a309b6e3d4a00486994cc9c05d9a1950ba2ea44757288f84ab86c574f283888
- 0x3adfe2cfa03c328503e52db7e55df36825c182fddbe877b32f2a3d35c031b268
- 0x9c8627879fb8cfe00ca8cc68125f8ba32f808950f3b2ba1ce467b8a79480e185
- 0x78f2e9f62ee016380c109a4f3d249145a1c0a58ab5c5df56ea071103885e50a9
- 0x3bfc21b157f623363dd3bf5622d0cc69c5e7ff7af2a654459349aa00bd363040
- 0xc403fb0fff8535d27424171dc2dd074e4e40fdd3a227f94954e9f1115a289c2c
- 0x1c90a8863a45674010e4f5153dcc0d3fd2808ca42bd17c8dfca1aef29dcc6aa0
- 0x7771814edeb7af35e32cf3aa77bf61a37d53488d536e97cd1930a0134e310be3
- 0x149f6f1f72469e438147da5e21917e992854b3b086918b04342a11178a924621
- 0x98ffd12658a495d8cfa0b2b386a43173d5f0ff0baff492bc3456181ec7fc6b0c
- 0x90a48ff46003d77ee085ec9804f99e8c50f9ac72ee9e01e851ce7237cdeafbe8
- 0x8ea5fb5953e042aee0d6574ec697ba0c88db5e988a4494fed6a07894cd46593a
- 0x098adb76843f4c771b9e999746c88fa74cf3b0780cd4d730da60624fde459097
- 0x8cb32382e59a922b429e1aec6a210b28857c00924fe335d806ccbff62dbad3cf
- 0xd42e2b27846b164764e62de9510824663d95ada3d62ce1f42fedb71a9f1adb5f
- 0xbb6ae93e7af5c54298c556053840795fc0f03791b424fddf996dbead49369b61
- 0xf0775f164fd73337c08ee40c6d4545a9ed53bccf4efb8d97c4a34f873392ecaa

## Related Records Removed

```json
{
  "finalizeKeys": 4,
  "reviewScores": 2,
  "submissions": 4,
  "lifecycleByChallenge": 13,
  "verifications": 12,
  "winners": 1,
  "fundingAttempts": 11,
  "approvalAttempts": 11,
  "fundingRecords": 177,
  "slugs": 15,
  "drafts": 82,
  "lifecycleOrphansSecondPass": 4
}
```

The second idempotent pass removed four legacy `ccn_lifecycle_events` rows for challenge `0xc71562ffa5142a1e1d071cd8107b59591901cd993787b19397c1d8ceba7d294b` where `draft_id` was null.

## Retained Records Verified

After cleanup counts:

```json
{
  "drafts": 1,
  "fundingRecords": 4,
  "approvalAttempts": 1,
  "fundingAttempts": 1,
  "submissions": 1,
  "finalizeKeys": 1,
  "reviewScores": 1,
  "winners": 1,
  "verifications": 2,
  "slugs": 1,
  "lifecycle": 3
}
```

Retained record evidence:

```json
{
  "draft": {
    "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
    "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
    "funding_intent_id": "426c90be-1c21-4798-923f-04c3145cbf73",
    "slug": "increase-customer-traffic-to-our-first-coffee-shop",
    "title": "Increase Customer Traffic to Our First Coffee Shop",
    "brand_name": "North Roast Coffee",
    "publication_status": "live",
    "funding_status": "live",
    "escrow_status": "verified",
    "event_verified": true,
    "draft_state": {
      "funding": {
        "network": "Arc Testnet",
        "walletId": "8c8506f9-52ff-5e07-8f50-0b281fc6ee84",
        "escrowStatus": "verified",
        "eventVerified": true,
        "fundingStatus": "live",
        "transactionId": "61a52d02-98ce-5535-97a7-71f2182640d5",
        "walletAddress": "0xedc35ad0b0f30923252b72595a8bc2b0135c8c38",
        "fundingIntentId": "426c90be-1c21-4798-923f-04c3145cbf73",
        "fundingLogIndex": "0x20",
        "transactionHash": "0x4212031ec32b3902cd86c0b89f76e9da4b05ab50e7b88a673813e255a9d9579e",
        "availableBalance": 64.8,
        "fundingBlockNumber": "0x34b356d",
        "fundingChallengeId": "3de3f1c4-71b7-5d21-a889-7ce7eb679b00",
        "lastBalanceRefreshAt": "2026-08-04T11:14:33.449Z",
        "approvalTransactionId": "6ee4a186-c504-5143-9c99-cabaccaa5d06",
        "approvalTransactionHash": "0x3365bbcdbf56b483648061b8b21b3d3e936f53e1796aff8f8275240caf352b66"
      },
      "challenge": {
        "id": "7897dca3-8299-4770-a013-e2595b92f5fe",
        "slug": "increase-customer-traffic-to-our-first-coffee-shop",
        "title": "Increase Customer Traffic to Our First Coffee Shop",
        "market": "Arc Testnet",
        "summary": "Our first coffee shop is open, but daily customer traffic is far below expectations despite positive customer feedback.",
        "category": "Motion Design",
        "deadline": "",
        "brandName": "North Roast Coffee",
        "attachments": [],
        "challengeId": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
        "description": "Increase weekday customer traffic by at least 40% within the next 60 days while maintaining a sustainable marketing budget.",
        "coverImageAlt": "Increase Customer Traffic to Our First Coffee Shop cover image",
        "coverImageKey": "campaigns/7897dca3-8299-4770-a013-e2595b92f5fe/cover/b17dd6ef-832b-43a1-a473-ee877b865ba6.jpg",
        "referenceLinks": [],
        "primaryDeliverable": "",
        "coverImageUpdatedAt": "2026-08-04T11:06:18.305Z",
        "slugReservedForTitle": "increase-customer-traffic-to-our-first-coffee-shop",
        "supportingDeliverables": [
          "Business Overview  We recently opened our first coffee shop in a busy urban neighborhood.  Customer satisfaction is excellent",
          "but brand awareness is still very low.  Current Situation  â€¢ Daily customer traffic is significantly below expectations. â€¢ Existing customers are satisfied but very few new customers discover us. â€¢ We have a limited marketing budget.  Target Audience  â€¢ Students â€¢ Young professionals â€¢ Local residents â€¢ Coffee enthusiasts aged 18â€“35  What We Have Already Tried  â€¢ Organic Instagram posts â€¢ Google Business Profile â€¢ Small opening campaign  These efforts generated only limited awareness.  We are looking for practical and executable business solutions that can realistically increase customer traffic over the next 60 days."
        ],
        "usageRightsAcknowledged": true
      },
      "prizePool": {
        "currency": "test USDC",
        "platformFee": 0.3,
        "totalAmount": 3,
        "winnerCount": 1,
        "estimatedGas": 0,
        "totalRequired": 3.3,
        "allocatedUnits": "3000000",
        "prizePoolUnits": "3000000",
        "remainingUnits": "0",
        "distributionMode": "recommended",
        "platformFeeUnits": "300000",
        "distributionUnits": [
          "3000000"
        ],
        "prizeDistribution": [
          {
            "place": "1st",
            "amount": 3,
            "currency": "test USDC"
          }
        ],
        "totalRequiredUnits": "3300000"
      },
      "updatedAt": "2026-08-04T11:14:33.885Z",
      "deployment": {
        "status": "success",
        "challengeId": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
        "currentStep": "review-rules",
        "errorMessage": "",
        "publicationStatus": "live"
      },
      "reviewRules": {
        "aiAllowed": false,
        "blindReview": true,
        "usageRights": "The winning creator transfers the predefined usage rights after selection.",
        "allowedFormats": [
          "MP4",
          "MOV",
          "PDF",
          "PNG",
          "JPG",
          "URL"
        ],
        "reviewDeadline": "2026-08-04T17:00",
        "judgingCriteria": [
          "Creativ fit"
        ],
        "submissionDeadline": "2026-08-04T16:00",
        "anonymousSubmission": true,
        "creatorAcknowledgement": true,
        "cancellationAcknowledgement": true
      }
    },
    "created_at": "2026-08-04T10:15:09.196697+00:00",
    "updated_at": "2026-08-04T11:14:33.885+00:00",
    "cover_image_key": "campaigns/7897dca3-8299-4770-a013-e2595b92f5fe/cover/b17dd6ef-832b-43a1-a473-ee877b865ba6.jpg",
    "cover_image_alt": "Increase Customer Traffic to Our First Coffee Shop cover image",
    "cover_image_updated_at": "2026-08-04T11:06:18.305+00:00"
  },
  "submissions": [
    {
      "submission_id": "ad946af1-8e75-4543-a2cf-94589187f13a",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "anonymous_entry_code": "ENTRY-1493",
      "status": "SUBMITTED"
    }
  ],
  "reviewScores": [
    {
      "score_id": "0df2f6c1-1cd6-4e20-ae9d-8a21e6808769",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "submission_id": "ad946af1-8e75-4543-a2cf-94589187f13a",
      "score": 80
    }
  ],
  "winners": [
    {
      "scope_key": "ccn-payout-operator-001:7897dca3-8299-4770-a013-e2595b92f5fe:0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4:426c90be-1c21-4798-923f-04c3145cbf73:WINNER_FINALIZATION",
      "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "state": "PAYOUT_CONFIRMED",
      "transaction_hash": "0xeb3ea29f053f386b1368fbe5c451f0d065867e7a5b91483a0eb001464034e034"
    }
  ],
  "verifications": [
    {
      "tx_hash": "0xeb3ea29f053f386b1368fbe5c451f0d065867e7a5b91483a0eb001464034e034",
      "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "event_type": "ChallengePayout"
    },
    {
      "tx_hash": "0x4212031ec32b3902cd86c0b89f76e9da4b05ab50e7b88a673813e255a9d9579e",
      "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "event_type": "ChallengeFunded"
    }
  ],
  "lifecycle": [
    {
      "event_id": "e841c484-4046-42eb-86bc-f335bbaddfd4",
      "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "event_type": "funding_verified"
    },
    {
      "event_id": "c934a67c-f785-4faa-8a24-9cbeb2c8e0f0",
      "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "event_type": "winner_finalized"
    },
    {
      "event_id": "2c1fb7e5-d48d-42e4-83f0-6a000246db33",
      "draft_id": "7897dca3-8299-4770-a013-e2595b92f5fe",
      "challenge_id": "0xaadff117a54cbb76efe489290b1b5e83d8309cfef74940f3f51d5d135aa933c4",
      "event_type": "SETTLEMENT_COMPLETED"
    }
  ]
}
```

The retained challenge remains live, funded, escrow verified, submitted, evaluated, winner-finalized, and payout-confirmed. Funding and payout transaction references remain in `ccn_onchain_verifications`.

## Files Backed Up

- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142717Z.localcreate-challenge-flow.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142717Z.localinternal-submissions-spike.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142717Z.env.local`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142717Zsupabase-before.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142717Zsupabase-removed.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142717Zsupabase-after.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Z.localcreate-challenge-flow.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Z.localinternal-submissions-spike.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Z.env.local`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Zsupabase-before.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Zsupabase-removed.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Zsupabase-after.json`
- `C:/Users/TB/Desktop/creator-challenge-network/.local/backups/p0-demo-challenge-cleanup-20260804T142830Zcleanup-result.json`

Backup files are intentionally under ignored local storage and must not be committed.

## Files Changed

Source/report files intended for commit:

- `scripts/cleanup-p0-demo-challenge-data.mjs`
- `scripts/verify-p0-demo-challenge-cleanup.mjs`
- `P0_DEMO_CHALLENGE_CLEANUP_REPORT.md`

Ignored local/runtime files changed but not intended for commit:

- `.local/create-challenge-flow.json`
- `.local/internal-submissions-spike.json`
- `.env.local` only had local smoke-test mode disabled so static public challenge mocks do not repopulate the cleaned demo.

## Seed And Fallback Behavior

- `CCN_LIFECYCLE_PERSISTENCE=supabase` remains active in `.env.local`.
- `CCN_SMOKE_TEST_MODE` was set to `false` locally to prevent static public challenge mocks from being included by `includeStaticChallengeMocks()`.
- `CCN_INCLUDE_STATIC_CHALLENGE_MOCKS` is not enabled locally and remains `false` in the Vercel env package.
- Seed scripts still exist but require explicit operator commands; they do not run on page refresh, dev-server restart, or login.
- The create-challenge path still supports new challenge creation through existing code; no admin delete feature or permanent UI workflow was added.

## Browser Storage Notes

Potential stale browser keys:

- sessionStorage: `ccn:create-challenge-demo-draft`
- localStorage: `ccn:brand-workspace-notifications-read`

Safe manual cleanup if stale draft UI appears: in the affected browser tab, remove `sessionStorage["ccn:create-challenge-demo-draft"]` and refresh. This is optional and does not replace server persistence cleanup.

## Tests

- `node scripts/verify-p0-demo-challenge-cleanup.mjs`: PASS
- `npm.cmd run test:create-challenge-store-safety`: PASS
- `npm.cmd run lint`: PASS
- `npm.cmd run typecheck`: PASS
- `npm.cmd run build`: PASS
- `git diff --check`: PASS

## Manual Browser Checklist

- Brand dashboard shows only retained challenge.
- Creator dashboard shows only retained challenge.
- Retained challenge opens.
- Finalized winner persists.
- Settlement persists.
- Refresh does not recreate drafts.

P0 DEMO CHALLENGE CLEANUP: PASS
