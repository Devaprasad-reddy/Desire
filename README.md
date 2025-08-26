# 🎯 Desire - NEET PG Counselling Data Viewer

A comprehensive web application for viewing and analyzing NEET PG counselling data across multiple years and categories. Features advanced filtering, rank history tracking, and GitHub Pages deployment.

## ✨ Features

- **Multi-year data support** - 2022, 2023, 2024 counselling data
- **Advanced filtering** - By year, category, college, course, rank range
- **Rank history tracking** - Click any rank to see counselling progression
- **Course normalization** - Merges similar courses with same codes
- **Duplicate handling** - Shows latest phase assignments (P1 → P2 → P3)
- **STRAY assignments** - Highlights late/upgrade assignments
- **State rank lookup** - Integrated merit list data
- **Responsive design** - Works on desktop and mobile
- **GitHub Pages ready** - Static hosting compatible

## 🚀 Live Demo

Access the application at: `https://yourusername.github.io/desire`

## 📁 File Structure

```
Desire/
├── index.html           # Main application
├── style.css            # Styling and responsive design
├── script.js            # Data processing and UI logic
├── data_manifest.json   # File registry for data loading
├── data/
│   └── JSONdata/        # Processed counselling and merit data
│       ├── NeetPG 22/   # 2022 data (CQ, MQ categories)
│       ├── NeetPG 23/   # 2023 data (CQ, MQ categories)
│       └── NeetPG 24/   # 2024 data (CQ, MQ categories)
└── README.md            # Documentation
```

## 🌐 GitHub Pages Deployment

1. **Fork or clone** this repository
2. **Push to GitHub** (ensure data/ folder is included)
3. **Enable Pages**: Settings → Pages → Deploy from branch
4. **Select branch**: main/master
5. **Access**: `https://yourusername.github.io/desire`

## 📊 Data Coverage

- **Years**: 2022, 2023, 2024
- **Categories**: CQ (Competent Authority), MQ (Management Quota)
- **AIQ Data**: Coming soon - All India Quota data will be parsed and updated
- **Phases**: P1, P2, P3, P4, P5, STRAY
- **Colleges**: 70+ medical colleges across Telangana
- **Courses**: 35+ medical specializations
- **Records**: 19,000+ candidate assignments

## 🔍 Key Features Explained

### Rank History
- Click any rank number to see complete counselling journey
- Shows phase-wise college/course changes
- Identifies upgrades and reassignments

### Course Normalization
- Merges courses with same codes but different names
- Example: "TM (036) - MD(TRANSFUSION MEDICINE)" combines multiple variants

### Duplicate Handling
- Same candidate may appear in multiple phases
- System shows final assignment (highest phase)
- STRAY tag indicates late assignments

### Advanced Filtering
- **Rank range**: Min/max NEET rank filtering
- **Multi-select**: Choose multiple years, categories, colleges
- **Search**: Real-time college/course name filtering
- **Special categories**: MIN, PH candidate identification

## 💡 Usage Tips

- **Start broad**: Select year/category first, then narrow down
- **Use rank history**: Click ranks to understand counselling flow
- **Check STRAY tags**: These show final upgrades/reassignments
- **Sort by rank**: Default sorting shows merit order
- **State ranks**: Integrated from official merit lists

## 🛠️ Technical Stack

- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Data**: JSON files processed from PDF sources
- **Hosting**: GitHub Pages (static hosting)
- **Performance**: Client-side processing, no backend required
- **Browser support**: Modern browsers with ES6+ support

## 🔄 Future Updates

**Upcoming:**
- **AIQ Data**: All India Quota counselling data will be parsed and added soon
- **Other State Quotas**: Support for other state quotas is still under consideration - please use [ZYNERD](https://zynerd.com) for comprehensive multi-state data

**For 2025 counselling data:**
1. Use included parsing tools (batch_parser.js, merit_parser.js)
2. Process new PDF files to JSON format
3. Update data_manifest.json with new file entries
4. Deploy updated data to GitHub Pages

## 📈 Data Statistics

- **Total candidates**: 19,793 unique assignments
- **Colleges covered**: 71 medical institutions
- **Specializations**: 39 medical courses
- **Years of data**: 3 years (2022-2024)
- **File size**: ~15MB total JSON data

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Test thoroughly
4. Submit pull request

## 📄 License

MIT License - feel free to use for educational purposes.

## ⚠️ Disclaimer

This application is for informational purposes only. Always verify data with official counselling authorities.