/*
 * IIIF Curation Editor v1.0
 * http://codh.rois.ac.jp/software/iiif-curation-editor/
 *
 * Copyright 2018 Center for Open Data in the Humanities, Research Organization of Information and Systems
 * Released under the MIT license
 *
 * Core contributor: Jun HOMMA (@2SC1815J)
 *
 * Licenses of open source libraries, see acknowledgements.txt
 */
/* eslint quotes: ["error", "double"] */
var curationSchema = {
    "title": "Curation",
    "description": "Simple schema of cr:Curation written by Jun HOMMA (@2SC1815J).",
    "type": "object",
    "definitions": {
        "httpuri": {
            "id": "#httpuri",
            "type": "string",
            "format": "uri",
            "pattern": "^https*:"
        },
        "label": {
            "id": "#label",
            "type": ["string", "object", "array"]
        },
        "idtypelabel": {
            "id": "#idtypelabel",
            "type": "object",
            "properties": {
                "@id": {"$ref": "#httpuri"},
                "@type": {"type": "string"},
                "label": {"$ref": "#label"}
            },
            "required": ["@id", "@type", "label"]
        }
    },
    "properties": {
        "@context": {
            "const": ["http://iiif.io/api/presentation/2/context.json", "http://codh.rois.ac.jp/iiif/curation/1/context.json"]
        },
        "@id": {"$ref": "#httpuri"},
        "@type": {"const": "cr:Curation"},
        "label": {"$ref": "#label"},
        "selections": {
            "type": "array",
            "items": {
                "title": "Range",
                "type": "object",
                "properties": {
                    "@id": {"$ref": "#httpuri"},
                    "@type": {"const": "sc:Range"},
                    "label": {"$ref": "#label"},
                    "canvases": {
                        "type": "array",
                        "items": {"$ref": "#httpuri"}
                    },
                    "members": {
                        "type": "array",
                        "items": {"$ref": "#idtypelabel"}
                    },
                    "within": {
                        "oneOf": [{"$ref": "#httpuri"}, {"$ref": "#idtypelabel"}]
                    }
                },
                "required": ["@id", "@type", "label", "within"],
                "oneOf": [{"required": ["canvases"]}, {"required": ["members"]}]
            }
        }
    },
    "required": ["@context", "@id", "@type", "label", "selections"]
};